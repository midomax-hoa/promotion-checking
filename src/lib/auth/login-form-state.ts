/**
 * Shape passed between the login form and its Server Action.
 *
 * Lives outside the `'use server'` module because such a module may only export
 * async functions.
 */

export type LoginFormState = {
  status: 'idle' | 'error'
  message?: string
  /**
   * What was typed in the identifier box, so a rejected attempt does not also
   * make the operator retype their username. The password is never echoed back.
   */
  identifier?: string
}

export const INITIAL_LOGIN_STATE: LoginFormState = { status: 'idle' }
