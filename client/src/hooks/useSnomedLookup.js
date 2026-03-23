import { useEffect, useRef, useState } from "react";
import axios from "axios";

export function useSnomedLookup(tag, minLength = 3, delay = 600, limit = 20) {
  const [options, setOptions] = useState({});
  const [lookup, setLookup] = useState({});
  const timersRef = useRef({});

  useEffect(() => {
    const timers = timersRef.current;
    return () => {
      Object.values(timers).forEach((t) => t && clearTimeout(t));
    };
  }, []);

  const search = async (index, searchText) => {
    const trimmed = searchText.trim();

    if (trimmed.length < minLength) {
      setOptions((prev) => ({
        ...prev,
        [index]: [],
      }));
      return;
    }

    try {
      const response = await axios.get("/snomedgps/search", {
        params: {
          q: trimmed,
          tag,
          limit,
        },
      });

      setOptions((prev) => ({
        ...prev,
        [index]: response.data || [],
      }));
    } catch (error) {
      console.error(`Error searching SNOMED tag ${tag}:`, error);
      setOptions((prev) => ({
        ...prev,
        [index]: [],
      }));
    }
  };

  const handleLookupChange = (index, value, onExactMatch) => {
    setLookup((prev) => ({
      ...prev,
      [index]: value,
    }));

    const trimmedValue = value.trim();
    const selectedMatch = (options[index] || []).find(
      (item) =>
        (item.term_clean || "").trim().toLowerCase() === trimmedValue.toLowerCase() ||
        (item.term || "").trim().toLowerCase() === trimmedValue.toLowerCase()
    );

    if (selectedMatch) {
      onExactMatch(selectedMatch);
      return;
    }

    if (timersRef.current[index]) {
      clearTimeout(timersRef.current[index]);
    }

    if (trimmedValue.length < minLength) {
      setOptions((prev) => ({
        ...prev,
        [index]: [],
      }));
      return;
    }

    timersRef.current[index] = setTimeout(() => {
      search(index, trimmedValue);
    }, delay);
  };

  const findExactMatch = (index, value) => {
    const trimmed = (value || "").trim().toLowerCase();
    if (!trimmed) return null;

    return (options[index] || []).find(
      (item) =>
        (item.term_clean || "").trim().toLowerCase() === trimmed ||
        (item.term || "").trim().toLowerCase() === trimmed
    );
  };

  const resolveLookup = (index, onExactMatch) => {
    const value = lookup[index] || "";
    const match = findExactMatch(index, value);
    if (match) {
      onExactMatch(match);
    }
  };

  const initRow = (index) => {
    setOptions((prev) => ({ ...prev, [index]: [] }));
    setLookup((prev) => ({ ...prev, [index]: "" }));
  };

  const resetAll = () => {
    setOptions({});
    setLookup({});
  };

  return {
    options,
    lookup,
    setLookup,
    handleLookupChange,
    resolveLookup,
    initRow,
    resetAll,
  };
}