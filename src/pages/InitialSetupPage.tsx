import { InitialSetup } from "@/components/InitialSetup";

export default function InitialSetupPage() {
  const handleComplete = () => {
    // 설정 완료 후 홈으로 이동
    window.location.href = '/';
  };

  return <InitialSetup onComplete={handleComplete} />;
}