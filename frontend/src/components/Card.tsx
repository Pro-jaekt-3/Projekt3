type Props = {
  children: React.ReactNode;
  className?: string;
};

function Card({ children, className = "" }: Props) {
  return (
    <div className={`rounded-lg border border-slate-200 bg-white p-6 shadow-sm ${className}`}>
      {children}
    </div>
  );
}

export default Card;
