/** Thrown by any Store implementation for expected, mappable failures. */
export class StoreError extends Error {
  constructor(
    message: string,
    readonly status = 500,
  ) {
    super(message);
    this.name = "StoreError";
  }
}
