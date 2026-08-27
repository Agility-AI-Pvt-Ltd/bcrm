import { useRouter } from "next/navigation";

const useGoBack = () => {
  const router = useRouter();

  const goBack = () => {
    if (window.history.length > 1) {
      router.back(); // Navigate to the previous route
    } else {
      // No history to go back to — most often a link opened in a new tab. Send
      // them into the app rather than to the public landing page at `/`.
      router.push("/dashboard");
    }
  };

  return goBack;
};

export default useGoBack;
