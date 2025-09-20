import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import Index from "./pages/Index";
import { Auth } from "./pages/Auth";
import NotFound from "./pages/NotFound";
import IncomeDetails from "./pages/IncomeDetails";
import OtherDetails from "./pages/OtherDetails";
import ExpenseDetails from "./pages/ExpenseDetails";
import BalanceDetails from "./pages/BalanceDetails";
import CategoryManagement from "./pages/CategoryManagement";
import InitialSetupPage from "./pages/InitialSetupPage";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Routes>
            <Route path="/auth" element={<Auth />} />
            <Route 
              path="/" 
              element={
                <ProtectedRoute>
                  <Index />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/income" 
              element={
                <ProtectedRoute>
                  <IncomeDetails />
                </ProtectedRoute>
              } 
            />
              <Route
                path="/other"
                element={
                  <ProtectedRoute>
                    <OtherDetails />
                  </ProtectedRoute>
                }
              />
            <Route 
              path="/expense" 
              element={
                <ProtectedRoute>
                  <ExpenseDetails />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/balance" 
              element={
                <ProtectedRoute>
                  <BalanceDetails />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/categories" 
              element={
                <ProtectedRoute>
                  <CategoryManagement />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/initial-setup" 
              element={
                <ProtectedRoute>
                  <InitialSetupPage />
                </ProtectedRoute>
              } 
            />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;
