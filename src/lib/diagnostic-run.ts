export interface DiagnosticAnswer { id: string; chosen: number }

/**
 * Which answers the diagnostic sends to /api/diagnostic/next. Every step
 * posts all answers so far; the list only becomes "confirmed" once the
 * server accepted it. A retry after a failed step re-sends exactly what
 * failed — the old retry re-sent the confirmed list, dropping the answer
 * just given (it was logged but left out of θ, and a different next item
 * was served).
 */
export class DiagnosticRun {
  private confirmed: DiagnosticAnswer[] = [];
  private inFlight: DiagnosticAnswer[] = [];

  /** Answers the server has accepted. */
  get answers(): DiagnosticAnswer[] { return this.confirmed; }

  /** The payload for the next step: everything so far plus `answer`, if any. */
  send(answer?: DiagnosticAnswer): DiagnosticAnswer[] {
    this.inFlight = answer ? [...this.confirmed, answer] : this.confirmed;
    return this.inFlight;
  }

  /** The payload to retry after a failed step. */
  retry(): DiagnosticAnswer[] { return this.inFlight; }

  /** The server accepted `sent`. */
  accept(sent: DiagnosticAnswer[]): void { this.confirmed = sent; }
}
