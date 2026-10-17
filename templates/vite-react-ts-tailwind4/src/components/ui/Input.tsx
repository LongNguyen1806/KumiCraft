type InputProps = {
  readonly type?: 'text' | 'email' | 'password' | 'search';
  readonly placeholder?: string;
  readonly name?: string;
  readonly required?: boolean;
};

export function Input({ type = 'text', placeholder, name, required }: InputProps) {
  return (
    <input
      type={type}
      placeholder={placeholder}
      name={name}
      required={required}
      className="w-full rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm text-slate-900 placeholder-slate-400 focus:border-brand focus:outline-none"
    />
  );
}
