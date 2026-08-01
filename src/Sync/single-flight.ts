export default class SingleFlight<T> {
	private inFlight: Promise<T> | null = null;

	run(task: () => Promise<T>): Promise<T> {
		if (this.inFlight) {
			return this.inFlight;
		}

		const run = Promise.resolve().then(task);
		this.inFlight = run;
		void run.then(
			() => this.clear(run),
			() => this.clear(run),
		);
		return run;
	}

	private clear(run: Promise<T>) {
		if (this.inFlight === run) {
			this.inFlight = null;
		}
	}
}
