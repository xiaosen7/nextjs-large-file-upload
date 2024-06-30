"use client";

import { Loading } from "@/shared/components/loading";
import { Input } from "@/shared/components/ui/input";
import { Progress } from "@/shared/components/ui/progress";
import { mp } from "@/shared/utils/jsx";
import { unwrapActions } from "@/shared/utils/unwrap-action";
import {
  CheckIcon,
  Cross2Icon,
  PauseIcon,
  PlayIcon,
  ReloadIcon,
  TrashIcon,
} from "@radix-ui/react-icons";
import { useLocalStorageState, useMap, useMemoizedFn } from "ahooks";
import { sentenceCase } from "change-case";
import { get, uniqueId } from "lodash-es";
import { useObservable } from "rcrx";
import React, { memo, useEffect, useRef } from "react";
import { Observable } from "rxjs";
import { DEFAULTS } from "../constants/defaults";
import { IUploadClientActions, UploadClient } from "../models/client";
import { IUploadSetting, UploadSetting } from "./setting";

const AUTO_UPLOAD = true;

export interface IUploadProps {
  // @ts-ignore
  actions: IWrapServerActions<IUploadClientActions>;
}

export const Upload: React.FC<IUploadProps> = ({ actions }) => {
  const [setting, setSetting] = useLocalStorageState<IUploadSetting>(
    "uploadSetting",
    {
      defaultValue: {
        chunkSize: DEFAULTS.chunkSize,
        concurrency: DEFAULTS.concurrency,
      },
    }
  );

  const [clientMap, clientMapActions] = useMap<string, UploadClient>();

  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const scrollContainer = scrollContainerRef.current;

  const onChange = useMemoizedFn((async (e) => {
    Array.from(e.target.files ?? []).forEach((file) => {
      const id = uniqueId();
      const client = new UploadClient(
        file,
        unwrapActions(actions),
        setting?.concurrency,
        setting?.chunkSize
      );
      clientMap.set(id, client);
    });

    clientMapActions.setAll(clientMap);

    if (scrollContainer) {
      setTimeout(() => {
        (scrollContainer.lastChild as HTMLDivElement | null)?.scrollIntoView({
          behavior: "smooth",
        });
      }, 500);
    }
  }) satisfies React.ComponentProps<"input">["onChange"]);

  const onRemove = useMemoizedFn((id: string) => {
    clientMap.get(id)?.destroy();
    clientMapActions.remove(id);
  });

  return (
    <div className="flex flex-col gap-4 border border-solid py-4">
      <div className="flex gap-4 px-4">
        <Input
          value={""}
          className="flex-1 text-[0]"
          multiple
          type="file"
          onChange={onChange}
        />
        <UploadSetting
          value={setting}
          onChange={setSetting}
          disabled={clientMap.size > 0}
        />
      </div>

      <div ref={scrollContainerRef} className="h-64 overflow-auto px-4">
        {Array.from(clientMap.keys()).map((id) => (
          <UploadSingleFile
            key={id}
            client={clientMap.get(id)!}
            onRemove={() => onRemove(id)}
            {...setting}
          />
        ))}
      </div>
    </div>
  );
};

interface IUploadSingleFileProps {
  className?: string;
  onRemove?: () => void;
  concurrency?: number;
  client: UploadClient;
  chunkSize?: number;
}
const UploadSingleFile = memo(function UploadSingleFile(
  props: IUploadSingleFileProps
) {
  const { client, onRemove } = props;
  const file = client.file;

  useEffect(() => {
    client.start(AUTO_UPLOAD);
  }, [client]);

  const onPlay = useMemoizedFn(() => {
    client.startPool();
  });

  const onStop = useMemoizedFn(() => {
    client.stopPool();
  });

  const onRestart = useMemoizedFn(() => {
    client.restart(AUTO_UPLOAD);
  });

  const state = useObservable(client.state$, UploadClient.EState.Default);
  const error = useObservable(client.error$, null);

  const stateString =
    state === UploadClient.EState.Error && error
      ? get(error, "message")
      : state === UploadClient.EState.Default
      ? undefined
      : sentenceCase(UploadClient.EState[state]);

  return mp(
    props,
    <div className="py-2 flex flex-col gap-2">
      <div className="flex flex-col gap-2 justify-between">
        <div title={file.name} className="truncate">
          {file.name}
        </div>

        <div
          title={stateString}
          className="text-gray-500 text-xs flex gap-2 overflow-hidden"
        >
          <UploadStateIcon state$={client.state$} />
          <div className="truncate flex-1">{stateString}</div>
        </div>
      </div>

      <div className="flex gap-2 items-center">
        <RxProgress value$={client.progress$} />
        <div className="w-12 flex items-center justify-end">
          <UploadControl
            state$={client.state$}
            onPlay={onPlay}
            onStop={onStop}
            onRestart={onRestart}
          />
          <TrashIcon className="cursor-pointer ml-2" onClick={onRemove} />
        </div>
      </div>
    </div>
  );
});

const UploadStateIcon: React.FC<{
  state$: UploadClient["state$"];
}> = ({ state$ }) => {
  const state = useObservable(state$, UploadClient.EState.Default);

  switch (state) {
    case UploadClient.EState.Uploading:
    case UploadClient.EState.CheckingFileExists:
    case UploadClient.EState.CalculatingHash:
    case UploadClient.EState.Merging:
      return <Loading />;

    case UploadClient.EState.UploadSuccessfully:
    case UploadClient.EState.FastUploaded:
      return <CheckIcon color="green" />;

    case UploadClient.EState.Error:
      return <Cross2Icon color="red" />;

    default:
      return null;
  }
};

interface IUploadControlProps {
  onPlay?: () => void;
  onStop?: () => void;
  onRestart?: () => void;
  state$: UploadClient["state$"];
}
const UploadControl: React.FC<IUploadControlProps> = ({
  onPlay,
  onStop,
  onRestart,
  state$,
}) => {
  const state = useObservable(state$, UploadClient.EState.Default);

  switch (state) {
    case UploadClient.EState.WaitForUpload:
    case UploadClient.EState.UploadStopped:
      return <PlayIcon onClick={onPlay} className="cursor-pointer" />;

    case UploadClient.EState.Uploading:
      return <PauseIcon onClick={onStop} className="cursor-pointer" />;

    case UploadClient.EState.Error:
      return <ReloadIcon onClick={onRestart} className="cursor-pointer" />;

    default:
      return null;
  }
};

interface IRxProgressProps {
  value$: Observable<number>;
}
const RxProgress: React.FC<IRxProgressProps> = ({ value$ }) => {
  const value = useObservable(value$, 0);

  return <Progress className="h-1 my-2" value={value} />;
};
