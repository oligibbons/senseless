"use client";

import { useEffect, useState, use } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/src/lib/supabase";
import { finalizeRoundAction } from "@/src/app/actions/resolution";
import { Player, Prompt } from "@/src/types/database";
import levenshtein from "fast-levenshtein";
import { motion } from "framer-motion";
import { GrossOutContainer, ScreenShake } from "@/src/components/GrossOutContainer";

export default function ResolutionPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = use(params);
  const router = useRouter();

  const [playerId, setPlayerId] = useState<string | null>(null);
  const [players, setPlayers] = useState<Player[]>([]);
  const [imposter, setImposter] = useState<Player | null>(null);
  const [prompt, setPrompt] = useState<Prompt | null>(null);
  
  const [isCaught, setIsCaught] = useState<boolean | null>(null);
  const [stealGuess, setStealGuess] = useState("");
  const [stealResult, setStealResult] = useState<"pending" | "success" | "failed">("pending");
  const [isFinalizing, setIsFinalizing] = useState(false);

  useEffect(() => {
    const localId = localStorage.getItem("senseless_player_id");
    if (!localId) {
      router.replace("/");
      return;
    }
    setPlayerId(localId);

    const loadResolutionData = async () => {
      const { data: room } = await supabase.from("rooms").select("current_prompt_id, host_id").eq("room_code", code).single();
      if (!room || !room.current_prompt_id) return;

      const { data: promptData } = await supabase.from("prompts").select("*").eq("id", room.current_prompt_id).single();
      if (promptData) setPrompt(promptData as Prompt);

      const { data: playersData } = await supabase.from("players").select("*").eq("room_code", code);
      if (!playersData) return;
      
      setPlayers(playersData as Player[]);
      
      const foundImposter = playersData.find((p) => p.is_imposter);
      setImposter(foundImposter || null);

      if (foundImposter) {
        const voteCounts: Record<string, number> = {};
        playersData.forEach((p) => {
          if (p.voted_for) voteCounts[p.voted_for] = (voteCounts[p.voted_for] || 0) + 1;
        });

        const maxVotes = Math.max(...Object.values(voteCounts), 0);
        const peopleWithMaxVotes = Object.keys(voteCounts).filter(id => voteCounts[id] === maxVotes);
        
        const caught = peopleWithMaxVotes.length === 1 && peopleWithMaxVotes[0] === foundImposter.id;
        setIsCaught(caught);
      }
    };

    loadResolutionData();

    const channel = supabase
      .channel(`resolution_${code}`)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "rooms", filter: `room_code=eq.${code}` },
        (payload) => {
          if (payload.new.game_status === "lobby") {
            router.push(`/room/${code}`);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [code, router]);

  const handleStealAttempt = async () => {
    if (!imposter || !prompt || isFinalizing) return;
    setIsFinalizing(true);

    let success = false;
    const guess = stealGuess.trim().toLowerCase();
    const validAnswers = [prompt.true_target.toLowerCase(), ...prompt.true_synonyms.map(s => s.toLowerCase())];

    for (const answer of validAnswers) {
      const distance = levenshtein.get(guess, answer);
      if (distance <= 2) {
        success = true;
        break;
      }
    }

    setStealResult(success ? "success" : "failed");
    await finalizeRoundAction(code, imposter.id, true, success);
  };

  const handleHostContinue = async () => {
    if (!imposter || isFinalizing) return;
    setIsFinalizing(true);
    await finalizeRoundAction(code, imposter.id, false, false);
  };

  if (!imposter || isCaught === null) {
    return <div className="flex items-center justify-center h-full font-display text-4xl text-toxic-green animate-pulse">TALLYING VOTES...</div>;
  }

  const isMeImposter = playerId === imposter.id;

  return (
    <ScreenShake trigger={isCaught}>
      <GrossOutContainer delay={0.2}>
        <div className="flex flex-col h-full p-6 text-center">
          <div className="mt-8 space-y-4 border-b-4 border-fleshy-pink pb-8">
            <p className="font-sans text-white/70 font-bold uppercase tracking-widest text-sm">The Imposter Was</p>
            <motion.h1 
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="font-display text-6xl text-warning-yellow drop-shadow-chunky leading-tight"
            >
              {imposter.player_name}
            </motion.h1>
            {isCaught ? (
              <motion.div 
                initial={{ scale: 3, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ type: "spring", stiffness: 300, damping: 10, delay: 0.5 }}
                className="bg-toxic-green text-bruise-purple font-display text-4xl py-2 px-4 rounded-xl shadow-chunky inline-block transform rotate-2"
              >
                CAUGHT!
              </motion.div>
            ) : (
              <motion.div 
                initial={{ y: -50, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ type: "spring", stiffness: 200, damping: 15, delay: 0.5 }}
                className="bg-fleshy-pink text-white font-display text-4xl py-2 px-4 rounded-xl shadow-chunky inline-block transform -rotate-2"
              >
                ESCAPED!
              </motion.div>
            )}
          </div>

          {/* The Steal Phase */}
          {isCaught && stealResult === "pending" && (
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 1 }}
              className="flex-grow flex flex-col justify-center gap-6 mt-8"
            >
              {isMeImposter ? (
                <>
                  <p className="font-sans text-white font-bold text-lg">
                    You were caught. But you can steal the points if you guess the true target!
                  </p>
                  <div className="bg-dark-void border-4 border-toxic-green p-4 rounded-xl space-y-2">
                    <span className="text-toxic-green font-bold uppercase text-xs tracking-widest">Category Hint</span>
                    <p className="font-display text-3xl text-white">{prompt?.category}</p>
                  </div>
                  <input
                    type="text"
                    placeholder="EXACT TARGET..."
                    value={stealGuess}
                    onChange={(e) => setStealGuess(e.target.value)}
                    disabled={isFinalizing}
                    className="w-full bg-white text-bruise-purple font-display text-3xl text-center py-4 rounded-xl border-4 border-fleshy-pink focus:outline-none focus:border-warning-yellow uppercase disabled:opacity-50"
                  />
                  <motion.button
                    whileTap={{ scale: 0.95 }}
                    onClick={handleStealAttempt}
                    disabled={isFinalizing || stealGuess.length < 2}
                    className="w-full bg-fleshy-pink text-white font-display text-4xl py-4 rounded-xl shadow-chunky border-4 border-bruise-purple disabled:opacity-50"
                  >
                    {isFinalizing ? "CHECKING..." : "Attempt Steal"}
                  </motion.button>
                </>
              ) : (
                <div className="flex flex-col items-center gap-4 animate-pulse">
                  <span className="text-7xl">🚨</span>
                  <p className="font-display text-4xl text-fleshy-pink">
                    {imposter.player_name} IS ATTEMPTING A STEAL...
                  </p>
                </div>
              )}
            </motion.div>
          )}

          {/* The Resolution Results */}
          {(stealResult !== "pending" || !isCaught) && (
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 1 }}
              className="flex-grow flex flex-col justify-center gap-6 mt-8"
            >
              {isCaught ? (
                <div>
                  <p className="font-display text-4xl mb-2">
                    {stealResult === "success" ? "THE STEAL WAS SUCCESSFUL!" : "THE STEAL FAILED!"}
                  </p>
                  <p className="font-sans font-bold text-lg text-white/70">
                    The True Target was: <span className="text-warning-yellow">{prompt?.true_target}</span>
                  </p>
                </div>
              ) : (
                <p className="font-sans font-bold text-lg text-white/70">
                  The Imposter survives to lie another day.
                </p>
              )}

              {players.find(p => p.id === playerId)?.id === players.find(p => p.room_code === code)?.id && (
                 <motion.button
                 whileTap={{ scale: 0.95 }}
                 onClick={handleHostContinue}
                 disabled={isFinalizing}
                 className="mt-8 w-full bg-toxic-green text-bruise-purple font-display text-4xl py-4 rounded-xl shadow-chunky border-4 border-bruise-purple disabled:opacity-50"
               >
                 {isFinalizing ? "RESETTING..." : "Return to Lobby"}
               </motion.button>
              )}
            </motion.div>
          )}
        </div>
      </GrossOutContainer>
    </ScreenShake>
  );
}