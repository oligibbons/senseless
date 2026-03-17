export default function Home() {
    return (
      <div className="flex flex-col items-center justify-center flex-grow p-6 space-y-12">
        {/* Title Treatment */}
        <div className="text-center space-y-2">
          <h1 className="font-display text-7xl text-fleshy-pink drop-shadow-chunky-green uppercase tracking-wider transform -rotate-3">
            Senseless
          </h1>
          <p className="font-sans text-warning-yellow font-bold text-lg tracking-wide">
            Make sense of the nonsense.
          </p>
        </div>
  
        {/* Main Actions */}
        <div className="w-full flex flex-col gap-6 mt-8">
          <button className="w-full bg-toxic-green text-bruise-purple font-display text-4xl py-4 rounded-xl shadow-chunky transition-transform active:translate-y-1 active:shadow-none border-4 border-bruise-purple">
            Create Room
          </button>
          
          <div className="relative flex py-2 items-center">
            <div className="flex-grow border-t-2 border-fleshy-pink opacity-50"></div>
            <span className="flex-shrink-0 mx-4 text-fleshy-pink font-bold font-sans uppercase text-sm tracking-widest">Or</span>
            <div className="flex-grow border-t-2 border-fleshy-pink opacity-50"></div>
          </div>
  
          <div className="flex gap-3">
            <input 
              type="text" 
              placeholder="CODE" 
              maxLength={4}
              className="flex-1 bg-white text-bruise-purple font-display text-3xl text-center placeholder:text-gray-300 rounded-xl border-4 border-fleshy-pink focus:outline-none focus:border-warning-yellow uppercase"
            />
            <button className="bg-fleshy-pink text-white font-display text-3xl px-6 rounded-xl shadow-chunky transition-transform active:translate-y-1 active:shadow-none border-4 border-bruise-purple">
              Join
            </button>
          </div>
        </div>
      </div>
    );
  }