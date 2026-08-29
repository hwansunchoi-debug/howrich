import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import NewsHome from "./pages/news/NewsHome";
import NewsIssueDetail from "./pages/news/NewsIssueDetail";
import RunAnalysis from "./pages/news/RunAnalysis";
import ScoreGuide from "./pages/news/ScoreGuide";
import IssueArticles from "./pages/news/IssueArticles";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <BrowserRouter basename={import.meta.env.BASE_URL}>
      <Routes>
        <Route path="/" element={<NewsHome />} />
        <Route path="/issue/:issueId" element={<NewsIssueDetail />} />
        <Route path="/issue/:issueId/articles" element={<IssueArticles />} />
        <Route path="/run" element={<RunAnalysis />} />
        <Route path="/score" element={<ScoreGuide />} />
        <Route path="*" element={<NotFound />} />
      </Routes>
    </BrowserRouter>
  </QueryClientProvider>
);

export default App;
