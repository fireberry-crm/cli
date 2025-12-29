import { useState, useEffect, useMemo } from "react";
import FireberryClientSDK from "@fireberry/sdk/client";
import { Button, Typography, DSThemeContextProvider } from "@fireberry/ds";

function App() {
  const [isInitialized, setIsInitialized] = useState(false);
  const [initError, setInitError] = useState(null);
  const [context, setContext] = useState(null);
  const [api, setApi] = useState(null);
  const [isLoading, setIsLoading] = useState(false);

  // Create a new instance (memoized to avoid recreating on every render)
  const client = useMemo(() => new FireberryClientSDK(), []);

  // Initialize context on component mount
  useEffect(() => {
    const initializeContext = async () => {
      try {
        await client.initializeContext();
        setIsInitialized(true);
        setContext(client.context);
        setApi(client.api);
      } catch (error) {
        setInitError(error);
        console.error("Failed to initialize context:", error);
      }
    };

    initializeContext();
  }, [client]);

  const handleButtonClick = async () => {
    setIsLoading(true)
    if (context.record && context?.user.id) {
      await api.update(context.record.type, context.record.id, {
        ownerid: context?.user.id,
      });
    }
    setIsLoading(false)
  };

  return (
    <DSThemeContextProvider isRtl={false}>
      {initError ? (
        <div>
          <h1>Error Initializing Context</h1>
          <p>Error: {initError.message || String(initError)}</p>
        </div>
      ) : isInitialized ? (
        <div>
          <Typography type="h3" color="information">Hello {context?.user.fullName}!</Typography>
          <Typography >Click <Typography color="success" >Assign</Typography> button to assign record to current user ({context?.user.fullName})</Typography>
          <p style={{ marginBottom: "10px" }}><Button onClick={handleButtonClick} label="Assign" isLoading={isLoading}></Button></p>
        </div>
      ) : (
        <div>
          <h1>Initializing Context...</h1>
        </div>
      )}
    </DSThemeContextProvider>
  );
}

export default App;
