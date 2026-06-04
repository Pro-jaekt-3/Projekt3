type Props = {
  children: React.ReactNode;
  className?: string;
};

function PageContainer({
  children,
  className = "",
}: Props) {
  return (
    <div className={`mx-auto max-w-7xl px-6 py-8 sm:px-8 lg:py-10 ${className}`}>
      {children}
    </div>
  );
}

export default PageContainer;
