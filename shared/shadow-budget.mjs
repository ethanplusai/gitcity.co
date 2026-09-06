export function shadowBudget({ compact, walking, economical }) {
  return {
    enabled: !compact || (walking && !economical),
    size: compact ? 512 : 1024,
  };
}
