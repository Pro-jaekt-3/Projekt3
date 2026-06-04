type Props = {
  children: React.ReactNode;
};

function Card({ children }: Props) {
  return (
    <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
      {children}
    </div>
  );
}

export default Card;