/**
 * Represents the data needed to send an email.
 */
export interface Email {
  /**
   * The recipient's email address.
   */
  to: string;
  /**
   * The subject of the email.
   */
  subject: string;
  /**
   * The body of the email.
   */
  body: string;
}

/**
 * Asynchronously sends an email.
 *
 * @param email The email to send.
 * @returns A promise that resolves to true if the email was sent successfully, false otherwise.
 */
export async function sendEmail(email: Email): Promise<boolean> {
  // TODO: Implement this by calling an API.

  console.log(`Sending email to ${email.to} with subject ${email.subject}`);
  return true;
}
