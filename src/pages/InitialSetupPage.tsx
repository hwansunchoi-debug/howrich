import { useNavigate } from "react-router-dom";
import { InitialSetup } from "@/components/InitialSetup";

export default function InitialSetupPage() {
  const navigate = useNavigate();
  
  const handleComplete = () => {
    // 설정 완료 후 홈으로 이동
    navigate('/', { replace: true });
  };

  const handleBack = () => {
    // 뒤로가기 - 메인화면으로 이동
    navigate('/', { replace: true });
  };

  return <InitialSetup onComplete={handleComplete} onBack={handleBack} />;
}