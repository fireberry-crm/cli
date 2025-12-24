import { useState } from "react";
import { Button, Typography, DSThemeContextProvider } from "@fireberry/ds";

function App() {
  const [isLoading, setIsLoading] = useState(false);

  const handleButtonClick = async () => {
    setIsLoading(true);
    // Add your logic here
    setTimeout(() => {
      setIsLoading(false);
    }, 1000);
  };

  return (
    <DSThemeContextProvider isRtl={false}>
      <div>
        <Typography type="h3" color="information">Hello from Fireberry!</Typography>
        <Typography>This is a Fireberry component built with React + Vite</Typography>
        <p style={{ marginBottom: "10px" }}>
          <Button onClick={handleButtonClick} label="Click Me" isLoading={isLoading}></Button>
        </p>
      </div>
    </DSThemeContextProvider>
  );
}

export default App;
