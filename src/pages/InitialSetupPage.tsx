import { InitialSetup } from "@/components/InitialSetup";

export default function InitialSetupPage() {
  const handleComplete = () => {
    // 설정 완료 후 홈으로 이동하고 완전히 새로고침하여 모든 데이터가 반영되도록 함
    setTimeout(() => {
      window.location.replace('/');
    }, 500);
  };

  return <InitialSetup onComplete={handleComplete} />;
}