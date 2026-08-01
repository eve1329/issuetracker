import SingleFlight from '../../src/Sync/single-flight';

function deferred<T>() {
	let resolve!: (value: T) => void;
	const promise = new Promise<T>((complete) => {
		resolve = complete;
	});
	return {promise, resolve};
}

describe('SingleFlight', () => {
	it('shares one in-progress run and allows a later run after it completes', async () => {
		const flight = new SingleFlight<void>();
		const firstRun = deferred<void>();
		const task = jest.fn(() => firstRun.promise);

		const first = flight.run(task);
		const duplicate = flight.run(task);

		expect(duplicate).toBe(first);
		await Promise.resolve();
		expect(task).toHaveBeenCalledTimes(1);

		firstRun.resolve();
		await first;

		const laterRun = deferred<void>();
		task.mockReturnValueOnce(laterRun.promise);
		const later = flight.run(task);
		await Promise.resolve();
		expect(task).toHaveBeenCalledTimes(2);
		laterRun.resolve();
		await later;
	});
});
