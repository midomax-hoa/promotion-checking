/**
 * The anchor id for a rule group, in one place.
 *
 * The jump list lives on the configuration page and the targets live inside the
 * rule table, so without a shared helper the two would be free to disagree and
 * the links would silently go nowhere.
 */

export function ruleGroupAnchor(groupCode: string): string {
  return `nhom-${groupCode.toLowerCase()}`
}
