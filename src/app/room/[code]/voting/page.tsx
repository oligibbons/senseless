"use client";

import { useEffect, useState, use } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/src/lib/supabase";
import { submitVoteAction } from "@/src/app/actions/voting";
import { Player } from "@/src/types/database";
import { motion } from "framer-motion";
import { GrossOutContainer } from "@/src/components/GrossOutContainer";

// Fisher-Yates shuffle to randomize clues
function shuffleArray<T>(array: T[]): T[] {
  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

export default function VotingPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = use(params);
  const router = useRouter();

  const [playerId, setPlayerId] = useState<string | null>(null);
  const [clues, setClues] = useState<Player[]>([]);
  const [selectedSuspect, setSelectedSuspect] = useState<string | null>(null);
  const [isVoted, setIsVoted] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  useEffect(() => {
    const localId = localStorage.getItem("senseless_player_id");
    if (!localId) {
      router.replace("/");
      return;
    }
    setPlayerId(localId);

    const loadVotingData = async () => {
      const { data: playersData } = await supabase
        .from("players")
        .select("id, current_clue, assigned_sense, voted_for")
        .eq("room_code", code);

      if (!playersData) return;

      const me = playersData.find(p => p.id === localId);
      if (me && me.voted_for) {
        setIsVoted(true);
      }

      const validClues = playersData.filter(p => p.current_clue) as Player[];
      setClues(shuffleArray(validClues));
    };

    loadVotingData();

    const channel = supabase
      .channel(`voting_${code}`)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "rooms", filter: `room_code=eq.${code}` },
        (payload) => {
          if (payload.new.game_status === "resolution") {
            router.push(`/room/${code}/resolution`);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [code, router]);

  const handleVote = async () => {
    if (!playerId || !selectedSuspect) return;
    setIsSubmitting(true);
    setErrorMsg("");

    const result = await submitVoteAction(playerId, code, selectedSuspect);

    if (result.success) {
      setIsVoted(true);
    } else {
      setErrorMsg(result.error || "Failed to cast vote.");
      setIsSubmitting(false);
    }
  };

  if (clues.length === 0) {
    return (
      <div className="flex items-center justify-center h-full font-display text-4xl text-toxic-green animate-pulse">
        GATHERING CLUES...
      </div>
    );
  }

  if (isVoted) {
    return (
      <GrossOutContainer>
        <div className="flex flex-col items-center justify-center h-full p-6 text-center space-y-8">
          <motion.h1 
            initial={{ rotate: -10, scale: 0.5 }}
            animate={{ rotate: 0, scale: 1 }}
            className="font-display text-6xl text-warning-yellow drop-shadow-chunky"
          >
            VOTE CAST
          </motion.h1>
          <p className="font-sans text-xl font-bold">Awaiting the verdict...</p>
          <div className="w-16 h-16 border-8 border-warning-yellow border-t-transparent rounded-full animate-spin"></div>
        </div>
      </GrossOutContainer>
    );
  }

  // Animation variants for staggering the clues
  const containerVariants = {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: { staggerChildren: 0.15 }
    }
  };

  const itemVariants = {
    hidden: { opacity: 0, x: -50 },
    show: { opacity: 1, x: 0, transition: { type: "spring", stiffness: 300 } }
  };

  return (
    <GrossOutContainer>
      <div className="flex flex-col h-full p-6">
        {errorMsg && (
          <div className="bg-warning-yellow text-bruise-purple font-bold p-3 rounded-xl text-center mb-4 border-4 border-bruise-purple">
            {errorMsg}
          </div>
        )}

        <div className="text-center mt-4 mb-6 space-y-2">
          <h1 className="font-display text-5xl text-fleshy-pink drop-shadow-chunky leading-tight">
            WHO IS THE IMPOSTER?
          </h1>
          <p className="font-sans text-white/70 font-bold text-sm">Read the clues. Trust no one.</p>
        </div>

        {/* Clues List - Now Animated */}
        <motion.div 
          variants={containerVariants}
          initial="hidden"
          animate="show"
          className="flex-grow flex flex-col gap-4 overflow-y-auto pb-4"
        >
          {clues.map((suspect) => {
            if (suspect.id === playerId) return null;

            const isSelected = selectedSuspect === suspect.id;

            return (
              <motion.button
                variants={itemVariants}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                key={suspect.id}
                onClick={() => setSelectedSuspect(suspect.id)}
                className={`w-full p-4 rounded-xl border-4 text-left transition-colors ${
                  isSelected
                    ? "bg-warning-yellow border-bruise-purple shadow-chunky-green text-bruise-purple"
                    : "bg-dark-void border-fleshy-pink text-white"
                }`}
              >
                <div className="font-sans font-bold text-xs uppercase tracking-widest opacity-70 mb-1">
                  Sense: {suspect.assigned_sense}
                </div>
                <div className="font-display text-3xl leading-none">
                  "{suspect.current_clue}"
                </div>
              </motion.button>
            );
          })}
        </motion.div>

        {/* Action Footer */}
        <motion.div 
          initial={{ y: 50, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.5 }}
          className="mt-auto pt-6"
        >
          <button
            onClick={handleVote}
            disabled={!selectedSuspect || isSubmitting}
            className={`w-full font-display text-4xl py-4 rounded-xl border-4 border-bruise-purple transition-all ${
              selectedSuspect && !isSubmitting
                ? "bg-toxic-green text-bruise-purple shadow-chunky active:translate-y-1 active:shadow-none"
                : "bg-gray-500 text-gray-300 opacity-50 cursor-not-allowed"
            }`}
          >
            {isSubmitting ? "CASTING VOTE..." : "Lock Vote"}
          </button>
        </motion.div>
      </div>
    </GrossOutContainer>
  );
}