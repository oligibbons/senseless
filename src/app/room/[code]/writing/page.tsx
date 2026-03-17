"use client";

import { useEffect, useState, use } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/src/lib/supabase";
import { submitClueAction } from "@/src/app/actions/writing";

const SENSE_UI: Record<string, { icon: string; label: string; color: string }> = {
  Sight: { icon: "👁️", label: "BLOODSHOT EYES", color: "text-fleshy-pink" },
  Sound: { icon: "👂", label: "OOZING EARS", color: "text-warning-yellow" },
  Smell: { icon: "👃", label: "HAIRY NOSE", color: "text-toxic-green" },
  Touch: { icon: "🖐️", label: "BLISTERED HANDS", color: "text-fleshy-pink" },
  Taste: { icon: "👅", label: "SLOBBERING TONGUE", color: "text-warning-yellow" },
};

export default function WritingPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = use(params);
  const router = useRouter();

  const [playerId, setPlayerId] = useState<string | null>(null);
  const [target, setTarget] = useState<string>("");
  const [sense, setSense] = useState<string>("");
  const [clue, setClue] = useState("");
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  useEffect(() => {
    const localId = localStorage.getItem("senseless_player_id");
    if (!localId) {
      router.replace("/");
      return;
    }
    setPlayerId(localId);

    const loadPhaseData = async () => {
      // 1. Get room's current prompt ID
      const { data: room } = await supabase
        .from("rooms")
        .select("current_prompt_id")
        .eq("room_code", code)
        .single();

      if (!room || !room.current_prompt_id) return;

      // 2. Get player's assigned sense and imposter status
      const { data: player } = await supabase
        .from("players")
        .select("is_imposter, assigned_sense, current_clue")
        .eq("id", localId)
        .single();

      if (!player) return;

      setSense(player.assigned_sense || "Sight");

      // If they already submitted (e.g., they refreshed the page), lock them out
      if (player.current_clue) {
        setIsSubmitted(true);
      }

      // 3. Get the prompt content
      const { data: prompt } = await supabase
        .from("prompts")
        .select("true_target, imposter_target")
        .eq("id", room.current_prompt_id)
        .single();

      if (!prompt) return;

      // The Imposter is fed the fake target. They have no idea.
      setTarget(player.is_imposter ? prompt.imposter_target : prompt.true_target);
    };

    loadPhaseData();

    // 4. Listen for the global phase change to "voting"
    const channel = supabase
      .channel(`writing_${code}`)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "rooms", filter: `room_code=eq.${code}` },
        (payload) => {
          if (payload.new.game_status === "voting") {
            router.push(`/room/${code}/voting`);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [code, router]);

  const handleSubmit = async () => {
    if (!playerId || clue.trim().length === 0) return;
    setIsSubmitting(true);
    setErrorMsg("");

    const result = await submitClueAction(playerId, code, clue);

    if (result.success) {
      setIsSubmitted(true);
    } else {
      setErrorMsg(result.error || "Failed to submit clue.");
      setIsSubmitting(false);
    }
  };

  if (!target || !sense) {
    return <div className="flex items-center justify-center h-full font-display text-4xl text-toxic-green animate-pulse">EXTRACTING DATA...</div>;
  }

  const activeSense = SENSE_UI[sense];
  const charsLeft = 50 - clue.length;

  if (isSubmitted) {
    return (
      <div className="flex flex-col items-center justify-center h-full p-6 text-center space-y-8">
        <h1 className="font-display text-6xl text-toxic-green drop-shadow-chunky">CLUE LOCKED</h1>
        <p className="font-sans text-xl font-bold">Waiting for the other meat-sacks to finish writing...</p>
        <div className="text-8xl animate-bounce">{activeSense.icon}</div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full p-6">
      {errorMsg && (
        <div className="bg-warning-yellow text-bruise-purple font-bold p-3 rounded-xl text-center mb-4 border-4 border-bruise-purple">
          {errorMsg}
        </div>
      )}

      {/* Target Reveal */}
      <div className="text-center mt-4 mb-8 space-y-2">
        <p className="font-sans text-fleshy-pink font-bold uppercase tracking-widest text-sm">Your Target Is:</p>
        <h1 className="font-display text-5xl text-white drop-shadow-chunky leading-tight border-4 border-fleshy-pink p-4 rounded-xl bg-dark-void">
          {target}
        </h1>
      </div>

      {/* Sense Assignment */}
      <div className="text-center mb-8 flex flex-col items-center">
        <p className="font-sans text-white/70 font-bold uppercase tracking-widest text-sm mb-2">Describe it using only your:</p>
        <div className="text-6xl mb-2">{activeSense.icon}</div>
        <h2 className={`font-display text-4xl ${activeSense.color} tracking-widest`}>
          {activeSense.label}
        </h2>
      </div>

      {/* Input Area */}
      <div className="mt-auto flex flex-col gap-4">
        <div className="relative">
          <textarea
            value={clue}
            onChange={(e) => setClue(e.target.value)}
            maxLength={50}
            disabled={isSubmitting}
            placeholder="Type your clue here..."
            className="w-full h-32 bg-white text-bruise-purple font-sans font-bold text-2xl p-4 rounded-xl border-4 border-toxic-green focus:outline-none focus:border-warning-yellow resize-none disabled:opacity-50"
          />
          <span className={`absolute bottom-3 right-3 font-display text-2xl ${charsLeft <= 10 ? 'text-fleshy-pink' : 'text-gray-400'}`}>
            {charsLeft}
          </span>
        </div>

        <button
          onClick={handleSubmit}
          disabled={isSubmitting || clue.trim().length === 0}
          className="w-full bg-toxic-green text-bruise-purple font-display text-4xl py-4 rounded-xl shadow-chunky transition-transform active:translate-y-1 active:shadow-none border-4 border-bruise-purple disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isSubmitting ? "LOCKING..." : "Lock Clue"}
        </button>
      </div>
    </div>
  );
}