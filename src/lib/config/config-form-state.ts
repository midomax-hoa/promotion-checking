/**
 * Shapes shared by the configuration screen and its Server Actions.
 *
 * Lives outside the `'use server'` module because such a module may only export
 * async functions.
 */

export type ConfigFormState = {
  status: 'idle' | 'saved' | 'error'
  message?: string
  /** Keyed by form field name, so the offending input can be marked in place. */
  fieldErrors?: Record<string, string>
  /**
   * The raw strings the rejected submit carried, so the screen can show what was
   * typed next to the message about it. React resets a form once its action
   * returns, so without this the input would spring back to the stored value and
   * the error would point at a field that looks fine.
   */
  values?: Record<string, string>
  /**
   * Bumped on every action result. The form keys its inputs on it so a reset
   * re-renders them with the stored values instead of what was typed before.
   */
  version: number
}

export const INITIAL_CONFIG_STATE: ConfigFormState = { status: 'idle', version: 0 }

export const settingField = (key: string) => `setting:${key}`
