import { Label } from "@/shared/components/ui/label";
import { Slider } from "@/shared/components/ui/slider";
import {
  ToggleGroup,
  ToggleGroupItem,
} from "@/shared/components/ui/toggle-group";
import { cn } from "@/shared/utils";
import { useControllableValue } from "ahooks";
import { filesize } from "filesize";
import { values } from "lodash-es";
import React from "react";
import { DEFAULTS } from "../constants/defaults";
import { ESupportedProtocol } from "../types";

export interface IUploadSetting {
  concurrency: number;
  chunkSize: number;
  protocol: ESupportedProtocol;
}

export interface IUploadSettingProps {
  value?: IUploadSetting;
  onChange?: (value: IUploadSetting) => void;
  defaultValue?: IUploadSetting;
  disabled?: boolean;
}

export const UploadSetting: React.FC<IUploadSettingProps> = (props) => {
  const { disabled } = props;
  const [value, onChange] = useControllableValue<IUploadSetting>(props, {});

  return (
    <div className={cn(disabled && "cursor-not-allowed")}>
      <div className="grid grid-cols-4 items-center gap-4">
        <Label className="text-left" htmlFor="chunkSize">
          Chunk Size
        </Label>
        <Slider
          disabled={disabled}
          className="col-span-2"
          id="chunkSize"
          max={DEFAULTS.maxChunkSize}
          min={DEFAULTS.minChunkSize}
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
          disabled={disabled}
          className="col-span-2"
          id="concurrency"
          max={DEFAULTS.minConcurrency}
          min={1}
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

      <div className="grid grid-cols-4 items-center gap-4">
        <Label className="text-left" htmlFor="maxWidth">
          Protocol
        </Label>

        <ToggleGroup
          disabled={disabled}
          className="col-span-2"
          value={value.protocol}
          type="single"
          onValueChange={(protocol) => {
            onChange({
              ...value,
              protocol: protocol as ESupportedProtocol,
            });
          }}
        >
          {values(ESupportedProtocol).map((protocol) => (
            <ToggleGroupItem className="w-1/2" key={protocol} value={protocol}>
              {protocol}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
      </div>
    </div>
  );
};
