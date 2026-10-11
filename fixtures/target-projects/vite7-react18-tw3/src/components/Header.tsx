type HeaderProps = { title: string };

export function Header({ title }: HeaderProps) {
  return (
    <header className="border-b border-gray-200 px-6 py-4">
      <h1 className="text-xl font-semibold">{title}</h1>
    </header>
  );
}
