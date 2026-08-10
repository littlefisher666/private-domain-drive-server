function formatDateTime(value) {
  if (!value) {
    return "";
  }

  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) {
    // Keep original string if it is not a parseable date.
    return String(value);
  }

  const pad = (num) => String(num).padStart(2, "0");
  return [
    date.getUTCFullYear(),
    pad(date.getUTCMonth() + 1),
    pad(date.getUTCDate()),
  ].join("-") +
    " " +
    [
      pad(date.getUTCHours()),
      pad(date.getUTCMinutes()),
      pad(date.getUTCSeconds()),
    ].join(":");
}

module.exports = {
  formatDateTime,
};
