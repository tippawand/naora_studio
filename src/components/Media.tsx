/* eslint-disable @next/next/no-img-element */
const isVideo = (u: string) => /\.(mp4|mov|webm)(\?|$)/i.test(u);
const isAudio = (u: string) => /\.(mp3|wav|ogg|m4a|aac)(\?|$)/i.test(u);

export default function Media({ url, className = "" }: { url: string; className?: string }) {
  if (isVideo(url)) return <video src={url} controls loop playsInline className={className} />;
  if (isAudio(url)) return <audio src={url} controls className="w-full" />;
  return (
    <a href={url} target="_blank" rel="noreferrer">
      <img src={url} alt="" loading="lazy" className={className} />
    </a>
  );
}
