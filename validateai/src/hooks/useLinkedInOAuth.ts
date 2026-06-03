const LINKEDIN_SCOPES = 'openid profile email';

export function useLinkedInOAuth() {
  const initiateOAuth = (returnTo: string) => {
    const state = btoa(JSON.stringify({
      return_to: returnTo,
      nonce: crypto.randomUUID(),
    }));
    sessionStorage.setItem('linkedin_oauth_state', state);

    const params = new URLSearchParams({
      response_type: 'code',
      client_id: import.meta.env.VITE_LINKEDIN_CLIENT_ID as string,
      redirect_uri: `${window.location.origin}/auth/linkedin/callback`,
      scope: LINKEDIN_SCOPES,
      state,
    });

    window.location.href = `https://www.linkedin.com/oauth/v2/authorization?${params}`;
  };

  return { initiateOAuth };
}
