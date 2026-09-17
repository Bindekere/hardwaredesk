export const formatUGX = (amount: number): string => {
  return new Intl.NumberFormat('en-UG', {
    style: 'currency',
    currency: 'UGX',
    maximumFractionDigits: 0,
  }).format(amount || 0);
};

export const formatUSD = (amount: number, rate = 3800): string => {
  const usd = (amount || 0) / rate;
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(usd);
};

export const formatCurrency = (amount: number, currency: 'UGX' | 'USD' = 'UGX'): string => {
  if (currency === 'USD') return formatUSD(amount);
  return formatUGX(amount);
};

export const formatDate = (dateString: string | Date): string => {
  if (!dateString) return '';
  const date = new Date(dateString);
  return date.toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
};

export const formatDateTime = (dateString: string | Date): string => {
  if (!dateString) return '';
  const date = new Date(dateString);
  return date.toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

/**
 * Parses user input that might be a fraction (e.g. "1/2", "1/4", "3/4", "1 1/2", "0.5", "½", "¼", "¾")
 * Returns a clean numeric floating-point value.
 */
export const parseFractionOrDecimal = (val: string | number | null | undefined): number => {
  if (val === null || val === undefined) return 0;
  if (typeof val === 'number') return isNaN(val) ? 0 : val;
  const str = String(val).trim();
  if (!str) return 0;

  // Replace unicode fractions
  const replaced = str
    .replace(/½/g, ' 1/2')
    .replace(/¼/g, ' 1/4')
    .replace(/¾/g, ' 3/4')
    .replace(/⅓/g, ' 1/3')
    .replace(/⅔/g, ' 2/3')
    .replace(/⅛/g, ' 1/8')
    .trim();

  // Mixed fraction like "1 1/2" or "2 1/4"
  if (replaced.includes('/')) {
    const parts = replaced.split(/\s+/);
    if (parts.length === 2) {
      const whole = parseFloat(parts[0]) || 0;
      const [num, den] = parts[1].split('/').map(n => parseFloat(n));
      if (den && !isNaN(num)) {
        return Math.round((whole + (num / den)) * 1000) / 1000;
      }
      return whole;
    } else {
      const [num, den] = replaced.split('/').map(n => parseFloat(n));
      if (den && !isNaN(num)) {
        return Math.round((num / den) * 1000) / 1000;
      }
      return 0;
    }
  }

  const num = parseFloat(replaced);
  return isNaN(num) ? 0 : num;
};

/**
 * Formats a quantity, showing clean fractional notation where appropriate (e.g. 0.5 -> "½", 1.5 -> "1 ½")
 */
export const formatQuantity = (qty: number | null | undefined): string => {
  if (qty === null || qty === undefined || isNaN(qty)) return '0';
  const rounded = Math.round(qty * 1000) / 1000;
  const whole = Math.floor(rounded);
  const frac = Math.round((rounded - whole) * 100) / 100;

  let fracStr = '';
  if (frac === 0.5) fracStr = '½';
  else if (frac === 0.25) fracStr = '¼';
  else if (frac === 0.75) fracStr = '¾';
  else if (frac === 0.33 || frac === 0.333) fracStr = '⅓';
  else if (frac === 0.67 || frac === 0.667) fracStr = '⅔';
  else if (frac === 0.125) fracStr = '⅛';
  else if (frac > 0) return String(rounded);

  if (fracStr) {
    return whole > 0 ? `${whole} ${fracStr}` : fracStr;
  }

  return String(rounded);
};
