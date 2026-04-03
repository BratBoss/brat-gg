"use client";

import { useState, useRef } from "react";
import { createClient } from "@/lib/supabase/client";

type InitialValues = {
  displayName: string;
  avatarPath: string | null;     // storage path — for saving
  avatarDisplayUrl: string | null; // signed URL — for display only
  hasApiKey: boolean;
  openrouterModel: string;
};

const MODELS = [
  { value: "x-ai/grok-4.1-fast", label: "Grok 4.1 Fast (default)" },
  { value: "deepseek/deepseek-v3.2", label: "DeepSeek V3.2" },
];

export default function SettingsClient({
  userId,
  initialValues,
}: {
  userId: string;
  initialValues: InitialValues;
}) {
  const [displayName, setDisplayName] = useState(initialValues.displayName);
  const [avatarPath, setAvatarPath] = useState<string | null>(initialValues.avatarPath);
  const [avatarDisplayUrl, setAvatarDisplayUrl] = useState<string | null>(
    initialValues.avatarDisplayUrl
  );
  const [apiKeyInput, setApiKeyInput] = useState("");
  const [hasApiKey, setHasApiKey] = useState(initialValues.hasApiKey);
  const [model, setModel] = useState(initialValues.openrouterModel);
  const [saving, setSaving] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  async function handleAvatarUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 2 * 1024 * 1024) {
      setError("Avatar must be under 2MB.");
      return;
    }

    setUploadingAvatar(true);
    setError(null);

    const supabase = createClient();
    const ext = file.name.split(".").pop() ?? "jpg";
    const path = `${userId}/avatar.${ext}`;

    const { error: uploadError } = await supabase.storage
      .from("avatars")
      .upload(path, file, { upsert: true });

    if (uploadError) {
      setError("Failed to upload avatar: " + uploadError.message);
      setUploadingAvatar(false);
      return;
    }

    // Generate a signed URL for immediate preview (private bucket).
    const { data: signed } = await supabase.storage
      .from("avatars")
      .createSignedUrl(path, 3600);

    setAvatarPath(path);
    setAvatarDisplayUrl(signed?.signedUrl ?? null);
    setUploadingAvatar(false);
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setSaved(false);

    const payload: Record<string, unknown> = {
      displayName,
      avatarPath,
      openrouterModel: model,
    };

    // Only include the API key field if the user typed something.
    // Leaving it empty when hasApiKey is true means "keep existing key".
    if (apiKeyInput.trim() !== "") {
      payload.openrouterApiKey = apiKeyInput;
    }

    const res = await fetch("/api/settings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    setSaving(false);

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "Failed to save settings.");
    } else {
      setSaved(true);
      if (apiKeyInput.trim() !== "") {
        setHasApiKey(true);
        setApiKeyInput("");
      }
      setTimeout(() => setSaved(false), 3000);
    }
  }

  return (
    <main className="max-w-lg mx-auto px-6 py-14">
      <div className="mb-10">
        <h1 className="text-2xl font-light text-[#d6e4d2] tracking-tight mb-1">
          Settings
        </h1>
        <p className="text-[#6b8a6e] text-sm">Your profile and preferences.</p>
      </div>

      <form onSubmit={handleSave} className="space-y-8">
        {/* Avatar */}
        <section className="space-y-3">
          <label className="text-xs tracking-widest uppercase text-[#4a5e4c]">
            Avatar
          </label>
          <div className="flex items-center gap-5">
            <div className="relative w-16 h-16 rounded-full overflow-hidden border border-[#2a3a2c] bg-[#161d17] shrink-0">
              {avatarDisplayUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={avatarDisplayUrl}
                  alt="Your avatar"
                  className="absolute inset-0 h-full w-full object-cover"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-[#4a5e4c] text-sm">
                  {displayName?.[0]?.toUpperCase() ?? "?"}
                </div>
              )}
            </div>
            <div>
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploadingAvatar}
                className="text-sm text-[#6b8a6e] hover:text-[#d6e4d2] transition-colors disabled:opacity-40"
              >
                {uploadingAvatar ? "Uploading…" : "Change avatar"}
              </button>
              <p className="text-[#4a5e4c] text-xs mt-0.5">JPG or PNG, max 2MB</p>
            </div>
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            onChange={handleAvatarUpload}
            className="hidden"
          />
        </section>

        {/* Display name */}
        <section className="space-y-2">
          <label
            htmlFor="displayName"
            className="text-xs tracking-widest uppercase text-[#4a5e4c]"
          >
            Display name
          </label>
          <input
            id="displayName"
            type="text"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            placeholder="What should your companions call you?"
            maxLength={60}
            className="w-full px-4 py-3 rounded-md bg-[#161d17] border border-[#2a3a2c] text-[#d6e4d2] placeholder-[#4a5e4c] text-sm focus:outline-none focus:border-[#5e7d5a] transition-colors"
          />
        </section>

        {/* Divider */}
        <div className="border-t border-[#2a3a2c]" />

        {/* OpenRouter API key */}
        <section className="space-y-2">
          <label
            htmlFor="apiKey"
            className="text-xs tracking-widest uppercase text-[#4a5e4c]"
          >
            OpenRouter API key
          </label>
          {hasApiKey && (
            <p className="text-[#5e7d5a] text-xs">
              A key is already saved. Enter a new one below to replace it.
            </p>
          )}
          <input
            id="apiKey"
            type="password"
            value={apiKeyInput}
            onChange={(e) => setApiKeyInput(e.target.value)}
            placeholder={hasApiKey ? "Leave blank to keep current key" : "sk-or-…"}
            className="w-full px-4 py-3 rounded-md bg-[#161d17] border border-[#2a3a2c] text-[#d6e4d2] placeholder-[#4a5e4c] text-sm focus:outline-none focus:border-[#5e7d5a] transition-colors font-mono"
          />
          <p className="text-[#4a5e4c] text-xs">
            Encrypted before storage. Never visible after saving.
          </p>
        </section>

        {/* Model */}
        <section className="space-y-2">
          <label
            htmlFor="model"
            className="text-xs tracking-widest uppercase text-[#4a5e4c]"
          >
            Chat model
          </label>
          <select
            id="model"
            value={model}
            onChange={(e) => setModel(e.target.value)}
            className="w-full px-4 py-3 rounded-md bg-[#161d17] border border-[#2a3a2c] text-[#d6e4d2] text-sm focus:outline-none focus:border-[#5e7d5a] transition-colors appearance-none"
          >
            {MODELS.map((m) => (
              <option key={m.value} value={m.value}>
                {m.label}
              </option>
            ))}
          </select>
        </section>

        {error && <p className="text-red-400/80 text-sm">{error}</p>}

        <button
          type="submit"
          disabled={saving || uploadingAvatar}
          className="w-full py-3 rounded-md bg-[#2a3a2c] hover:bg-[#3a4e3c] text-[#d6e4d2] text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {saving ? "Saving…" : saved ? "Saved" : "Save settings"}
        </button>
      </form>
    </main>
  );
}
