type Props = {
  children: React.ReactNode;
};

function PageContainer({ children }: Props) {
  return (
    <div className="max-w-7xl mx-auto px-8 py-8">
      {children}
    </div>
  );
}

export default PageContainer;