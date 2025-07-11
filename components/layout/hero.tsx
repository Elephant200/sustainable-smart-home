export function Hero() {
  return (
    <div className="flex flex-col gap-8 items-center text-center">
      <h1 className="text-4xl md:text-6xl font-bold text-gradient">
        Sustainable Smart Home
      </h1>
      <p className="text-xl text-muted-foreground max-w-2xl">
        Build a smarter, greener future for your home with intelligent automation 
        and sustainable living solutions.
      </p>
      <div className="w-full p-[1px] bg-gradient-to-r from-green-200 via-blue-200 to-green-200 my-4" />
    </div>
  );
}
