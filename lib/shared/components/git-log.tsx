"use client";

import React, { useEffect, useState } from "react";
import { mp } from "../utils/jsx";

export const GitLog: React.FC<{}> = (props) => {
  const [log, setLog] = useState<string>();

  useEffect(() => {
    fetch("/git.log")
      .then((res) => res.text())
      .then(setLog);
  }, []);
  return mp(props, <div className="text-gray-500 text-xs">{log}</div>);
};
