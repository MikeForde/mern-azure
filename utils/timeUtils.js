function stripMilliseconds(dateString) {
    if (!dateString) {
        //console.log("stripMilliseconds: dateString is null or undefined");
        return null;
    }
    const date = new Date(dateString);
    return date.toISOString().replace(/\.\d{3}Z$/, "Z");
}

function stripTime(dateString) {
    if (!dateString) {
        //console.log("stripTime: dateString is null or undefined");
        return null;
    }
    const date = new Date(dateString);
    return date.toISOString().split("T")[0];
}

module.exports = {
    stripMilliseconds,
    stripTime,
};