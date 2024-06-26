import { Label } from "@/shared/components/ui/label";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/shared/components/ui/popover";
import { Slider } from "@/shared/components/ui/slider";
import { cn } from "@/shared/utils";
import { GearIcon } from "@radix-ui/react-icons";
import { useControllableValue } from "ahooks";
import { filesize } from "filesize";
import React from "react";

const MAX_CHUNK_SIZE = 5 * 1024 * 1024;
const MIN_CHUNK_SIZE = 1024;
const MAX_CONCURRENCY = 10;
const MIN_CONCURRENCY = 1;

export interface IUploadSetting {
  concurrency: number;
  chunkSize: number;
}

export interface IUploadSettingProps {
  value?: IUploadSetting;
  onChange?: (value: IUploadSetting) => void;
  defaultValue?: IUploadSetting;
  disabled?: boolean;
}

export const UploadSetting: React.FC<IUploadSettingProps> = (props) => {
  const [value, onChange] = useControllableValue<IUploadSetting>(props, {});

  return (
    <Popover>
      <PopoverTrigger disabled={props.disabled}>
        <GearIcon
          className={cn(props.disabled && "text-gray-300 cursor-not-allowed")}
        />
      </PopoverTrigger>

      <PopoverContent className="w-[500px]">
        <div className="grid grid-cols-4 items-center gap-4">
          <Label className="text-left" htmlFor="chunkSize">
            Chunk Size
          </Label>
          <Slider
            className="col-span-2"
            id="chunkSize"
            max={MAX_CHUNK_SIZE}
            min={MIN_CHUNK_SIZE}
            step={1}
            value={[value.chunkSize]}
            onValueChange={([chunkSize]) => {
              onChange({
                ...value,
                chunkSize,
              });
            }}
          />
          <span>
            {filesize(value.chunkSize, {
              standard: "jedec",
            })}
          </span>
        </div>

        <div className="grid grid-cols-4 items-center gap-4">
          <Label className="text-left" htmlFor="maxWidth">
            Concurrency
          </Label>
          <Slider
            className="col-span-2"
            id="concurrency"
            max={MAX_CONCURRENCY}
            min={MIN_CONCURRENCY}
            step={1}
            value={[value.concurrency]}
            onValueChange={([concurrency]) => {
              onChange({
                ...value,
                concurrency,
              });
            }}
          />
          <span>{value.concurrency}</span>
        </div>
      </PopoverContent>
    </Popover>
  );
};
