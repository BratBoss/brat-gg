"use client";

import { useState, useRef } from "react";
import { createClient } from "@/lib/supabase/client";
import { MODELS } from "@/lib/models";

type InitialValues = {
  displayName: string;
  avatarPath: string | null;     // storage path — for saving
  avatarDisplayUrl: string | null; // signed URL — for display only
  hasApiKey: boolean;
  openrouterModel: string;
};

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
  // Tracks a storage path that should be deleted when Save succeeds.
  // Set on Remove; cleared on successful Save or if the user re-uploads over it.
  const pendingAvatarRemoval = useRef<string | null>(null);

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

    // If the user had a pending removal and is now uploading a new avatar,
    // the old file is either already gone or will be overwritten (upsert).
    pendingAvatarRemoval.current = null;
    setAvatarPath(path);
    setAvatarDisplayUrl(signed?.signedUrl ?? null);
    setUploadingAvatar(false);
  }

  function handleRemoveAvatar() {
    if (!avatarPath) return;
    // Stash the path for deletion at Save time; do not touch storage yet.
    pendingAvatarRemoval.current = avatarPath;
    setAvatarPath(null);
    setAvatarDisplayUrl(null);
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
      // DB is consistent — now safe to delete the old file from storage.
      if (pendingAvatarRemoval.current) {
        const supabase = createClient();
        await supabase.storage.from("avatars").remove([pendingAvatarRemoval.current]);
        pendingAvatarRemoval.current = null;
      }
      setSaved(true);
      if (apiKeyInput.trim() !== "") {
        setHasApiKey(true);
        setApiKeyInput("");
      }
      setTimeout(() => setSaved(false), 3000);
    }
  }

  return (
    <main className="max-w-lg mx-auto px-6 py-7 md:py-8">
      <div className="mb-6">
        <h1 className="text-2xl font-light text-[var(--th-text)] tracking-tight mb-1">
          Settings
        </h1>
        <p className="text-[var(--th-subtle)] text-sm">Your profile and preferences.</p>
      </div>

      <form onSubmit={handleSave} className="space-y-5">
        {/* Avatar */}
        <section className="space-y-2">
          <label className="text-xs tracking-widest uppercase text-[var(--th-muted)]">
            Avatar
          </label>
          <div className="flex items-center gap-5">
            <div className="relative w-16 h-16 rounded-full overflow-hidden border border-[var(--th-border)] bg-[var(--th-surface)] shrink-0">
              {avatarDisplayUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={avatarDisplayUrl}
                  alt="Your avatar"
                  className="absolute inset-0 h-full w-full object-cover"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-[var(--th-muted)] text-sm">
                  {displayName?.[0]?.toUpperCase() ?? "?"}
                </div>
              )}
            </div>
            <div className="flex flex-col gap-1.5">
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploadingAvatar}
                  className="text-sm text-[var(--th-subtle)] hover:text-[var(--th-text)] transition-colors disabled:opacity-40"
                >
                  {uploadingAvatar ? "Uploading…" : "Change avatar"}
                </button>
                {avatarDisplayUrl && (
                  <button
                    type="button"
                    onClick={handleRemoveAvatar}
                    disabled={uploadingAvatar}
                    className="text-sm text-[var(--th-muted)] hover:text-red-400/70 transition-colors disabled:opacity-40"
                  >
                    Remove
                  </button>
                )}
              </div>
              <p className="text-[var(--th-muted)] text-xs">JPG or PNG, max 2MB</p>
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
        <section className="space-y-1">
          <label
            htmlFor="displayName"
            className="text-xs tracking-widest uppercase text-[var(--th-muted)]"
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
            className="w-full px-4 py-3 rounded-md bg-[var(--th-surface)] border border-[var(--th-border)] text-[var(--th-text)] placeholder-[var(--th-muted)] text-base sm:text-sm focus:outline-none focus:border-[var(--th-accent)] transition-colors"
          />
        </section>

        {/* Divider */}
        <div className="border-t border-[var(--th-border)]" />

        {/* OpenRouter API key */}
        <section className="space-y-1">
          <label
            htmlFor="apiKey"
            className="text-xs tracking-widest uppercase text-[var(--th-muted)]"
          >
            OpenRouter API key
          </label>
          {hasApiKey && (
            <p className="text-[var(--th-accent)] text-xs">
              A key is already saved. Enter a new one below to replace it.
            </p>
          )}
          <input
            id="apiKey"
            type="password"
            value={apiKeyInput}
            onChange={(e) => setApiKeyInput(e.target.value)}
            placeholder={hasApiKey ? "Leave blank to keep current key" : "sk-or-…"}
            className="w-full px-4 py-3 rounded-md bg-[var(--th-surface)] border border-[var(--th-border)] text-[var(--th-text)] placeholder-[var(--th-muted)] text-base sm:text-sm focus:outline-none focus:border-[var(--th-accent)] transition-colors font-mono"
          />
          <p className="text-[var(--th-muted)] text-xs">
            Encrypted before storage. Never visible after saving.
          </p>
        </section>

        {/* Model */}
        <section className="space-y-1">
          <label
            htmlFor="model"
            className="text-xs tracking-widest uppercase text-[var(--th-muted)]"
          >
            Chat model
          </label>
          <select
            id="model"
            value={model}
            onChange={(e) => setModel(e.target.value)}
            className="w-full px-4 py-3 rounded-md bg-[var(--th-surface)] border border-[var(--th-border)] text-[var(--th-text)] text-base sm:text-sm focus:outline-none focus:border-[var(--th-accent)] transition-colors appearance-none"
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
          className="w-full py-3 rounded-md bg-[var(--th-border)] hover:bg-[var(--th-surface-hover)] text-[var(--th-text)] text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {saving ? "Saving…" : saved ? "Saved" : "Save settings"}
        </button>
      </form>
    </main>
  );
}
