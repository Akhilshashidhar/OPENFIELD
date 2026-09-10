import { ToolcraftButton as Button } from "@openfield/ui";
import { ToolcraftCard as Card } from "@openfield/ui";
import { ToolcraftText as Text } from "@openfield/ui";
import { ToolcraftTextAreaControl } from "@openfield/ui";
import type { GrokInput } from "../../../../services/kieai/image-generation";

interface Props {
  value: GrokInput;
  onChange: (v: GrokInput) => void;
  onSubmit: () => void;
  isLoading: boolean;
}

export function GrokForm({ value, onChange, onSubmit, isLoading }: Props) {
  return (
    <div className="space-y-4">
      <Card variant="blue" padding={2} className="border border-blue-500/30">
        <Text type="supporting" className="text-xs text-blue-400">
          Grok Imagine uses the source image as a reference for style and
          composition. An optional prompt can guide the transformation.
        </Text>
      </Card>

      <ToolcraftTextAreaControl
        label="Prompt (optional)"
        value={value.prompt ?? ""}
        onChange={(prompt) => onChange({ ...value, prompt: prompt || undefined })}
        placeholder="Optional: describe what you want to change or emphasize..."
        maxLength={1000}
        rows={3}
        width="100%"
      />

      <Button
        label={isLoading ? "Generating..." : "Generate with Grok Imagine"}
        onClick={onSubmit}
        isDisabled={isLoading}
        variant="primary"
        className="w-full"
      />
    </div>
  );
}
