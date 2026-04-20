/**
 * Formats a number as Indian Rupee currency.
 */
export const formatCurrency = (amount: number): string => {
  return `₹${Math.round(amount).toLocaleString('en-IN')}`;
};

/**
 * Formats a date string into a more readable format (e.g., 20 Apr 2024).
 */
export const formatDateShort = (dateStr: string): string => {
  if (!dateStr) return 'N/A';
  return new Date(dateStr).toLocaleDateString('en-IN', { 
    day: 'numeric', 
    month: 'short',
    year: 'numeric'
  });
};

/**
 * Formats a date string into a full format (e.g., 20/04/2024 10:30 AM).
 */
export const formatDateFull = (dateStr: string): string => {
  if (!dateStr) return 'N/A';
  const date = new Date(dateStr);
  return date.toLocaleDateString() + ' ' + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
};

/**
 * Generates a UPI URI for payment.
 */
export const getUpiUri = (recipient: { upi_id?: string; name?: string; full_name?: string }, amount: number, paymentDate: string): string => {
  const name = recipient.name || recipient.full_name || 'Recipient';
  
  // Format date from YYYY-MM-DD to DD/MM/YYYY for the note
  const dateParts = paymentDate.split('-');
  const formattedDate = dateParts.length === 3 ? `${dateParts[2]}/${dateParts[1]}/${dateParts[0]}` : paymentDate;
  const note = `${name} ${formattedDate}`;
  
  const formattedAmount = amount.toFixed(2);
  
  return `upi://pay?pa=${recipient.upi_id}&pn=${encodeURIComponent(name)}&tn=${encodeURIComponent(note)}&am=${formattedAmount}&cu=INR`;
};

/**
 * Parses PostGIS Hex EWKB for Point to WKT.
 */
export const parseHexEWKB = (hex: string): string | null => {
  if (!hex || typeof hex !== 'string' || hex.length < 50) return null;
  try {
    // PostGIS Hex EWKB for Point: 0101000020E6100000 (9 bytes) + 8 bytes Lon + 8 bytes Lat
    const lonHex = hex.slice(18, 34);
    const latHex = hex.slice(34, 50);

    const parseDouble = (h: string) => {
      const bytes = new Uint8Array(8);
      for (let i = 0; i < 8; i++) bytes[i] = parseInt(h.slice(i * 2, i * 2 + 2), 16);
      return new DataView(bytes.buffer).getFloat64(0, true);
    };

    return `POINT(${parseDouble(lonHex)} ${parseDouble(latHex)})`;
  } catch (e) {
    console.error('Error parsing hex location:', e);
    return null;
  }
};
