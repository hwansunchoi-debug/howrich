import { Link, useLocation } from "react-router-dom";
import { useEffect } from "react";

const NotFound = () => {
  const location = useLocation();

  useEffect(() => {
    console.error("404: 존재하지 않는 경로", location.pathname);
  }, [location.pathname]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="text-center">
        <p className="text-4xl font-bold text-foreground">404</p>
        <p className="mt-3 text-muted-foreground">페이지를 찾을 수 없습니다.</p>
        <Link to="/" className="mt-6 inline-block text-primary underline">
          이슈 목록으로
        </Link>
      </div>
    </div>
  );
};

export default NotFound;
