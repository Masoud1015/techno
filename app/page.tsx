// app/page.tsx
export default function Home() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-6 bg-gray-100 p-8">
      {/* خط اول با فونت پیدا */}
      <h1 className=" text-2xl font-semibold ">
        تکنوفارم با فونت پیدا (Peyda Bold)
      </h1>

      {/* خط دوم با فونت استعداد */}
      <p className="font-estedad text-2xl font-semibold text-red-500">
        تکنوفارم با فونت استعداد (Estedad Black)
      </p>
    </div>
  );
}