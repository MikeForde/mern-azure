export const formatDate = (dateString) => {
  if (dateString === null || !dateString) return "";
  const [datePart, timePart = ""] = dateString.split("T");
  const time = timePart ? timePart.split(".")[0] : "";
  return time ? `${datePart} ${time}` : datePart;
};

export const formatDateNoTime = (dateString) => {
  if (dateString === null || dateString === undefined || !dateString) return "";
  const [datePart] = dateString.split("T");
  return datePart || "";
};