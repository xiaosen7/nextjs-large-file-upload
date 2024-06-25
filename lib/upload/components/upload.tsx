"use client";

import { Loading } from "@/shared/components/loading";
import { Input } from "@/shared/components/ui/input";
import { Progress } from "@/shared/components/ui/progress";
import {
  CheckIcon,
  PauseIcon,
  PlayIcon,
  RocketIcon,
} from "@radix-ui/react-icons";
import { useCreation, useMemoizedFn } from "ahooks";
import { sentenceCase } from "change-case";
import { useObservable, useSubscribe } from "rcrx";
import React, { useEffect, useRef, useState } from "react";
import { Observable } from "rxjs";
import { IUploadClientApi } from "../models/client";
import { UploadUI } from "../models/ui";

export interface IUploaderProps {
  actions: IUploadClientApi;
}

export const Uploader: React.FC<IUploaderProps> = ({ actions }) => {
  const [files, setFiles] = useState<File[]>([]);

  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const scrollContainer = scrollContainerRef.current;

  const onChange = useMemoizedFn((async (e) => {
    const files = Array.from(e.target.files ?? []);
    setFiles((pre) => [...pre, ...files]);

    if (scrollContainer) {
      setTimeout(() => {
        (scrollContainer.lastChild as HTMLDivElement | null)?.scrollIntoView({
          behavior: "smooth",
        });
      }, 200);
    }
  }) satisfies React.ComponentProps<"input">["onChange"]);

  return (
    <div className="flex flex-col gap-4 border border-solid p-4">
      <Input multiple type="file" onChange={onChange} />

      <div ref={scrollContainerRef} className="h-64 overflow-auto">
        {files.map((file, index) => (
          <UploadSingleFile key={file.name + index} api={actions} file={file} />
        ))}
      </div>
    </div>
  );
};

interface IUploaderStateProps {
  file: File;
  api: IUploadClientApi;
}
function UploadSingleFile(props: IUploaderStateProps) {
  const { file, api } = props;

  const ui = useCreation(() => new UploadUI(file, api), [file, api]);

  useEffect(() => {
    ui.start();
  }, [ui]);

  const onPlay = useMemoizedFn(() => {
    ui.startPool();
  });

  const onStop = useMemoizedFn(() => {
    ui.stopPool();
  });

  const state = useObservable(ui.state$, ui.state$.value);
  useSubscribe(ui.state$, (state) => {
    if (state === UploadUI.EState.WaitForUpload) {
      ui.startPool();
    }
  });

  return (
    <div className="py-2">
      <div
        title={file.name}
        className="flex text-sm mb-2 justify-between gap-4"
      >
        <span className="truncate">{file.name}</span>
        <span className="whitespace-nowrap">
          {sentenceCase(UploadUI.EState[state])}
        </span>
      </div>
      <div className="flex gap-2 items-center">
        <RxProgress value$={ui.progress$} />
        <div className="w-16 flex items-center justify-center">
          <UploaderController
            state$={ui.state$}
            onPlay={onPlay}
            onStop={onStop}
          />
        </div>
      </div>
    </div>
  );
}

interface IUploaderControllerProps {
  onPlay?: () => void;
  onStop?: () => void;
  state$: UploadUI["state$"];
}
const UploaderController: React.FC<IUploaderControllerProps> = ({
  onPlay,
  onStop,
  state$,
}) => {
  const state = useObservable(state$, state$.value);
  // console.log(UploadUI.EState[state]);

  switch (state) {
    case UploadUI.EState.Default:
      return null;

    case UploadUI.EState.CalculatingHash:
      return <span className="text-xs">Analysis...</span>;

    case UploadUI.EState.WaitForUpload:
    case UploadUI.EState.UploadStopped:
      return <PlayIcon onClick={onPlay} className="cursor-pointer" />;

    case UploadUI.EState.Uploading:
      return <PauseIcon onClick={onStop} className="cursor-pointer" />;

    case UploadUI.EState.UploadSuccessfully:
      return <CheckIcon />;

    case UploadUI.EState.FastUploaded:
      return <RocketIcon />;

    default:
      return <Loading />;
  }
};

interface IUploaderInfoProps {
  value$: Observable<number>;
}
const RxProgress: React.FC<IUploaderInfoProps> = ({ value$ }) => {
  const value = useObservable(value$, 0);

  return <Progress className="h-1" value={value} />;
};
