export async function fetchAniListData<T>(
  query: string,
  variables: Record<string, unknown>
): Promise<T> {
  try {
    const response = await fetch("https://graphql.anilist.co", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({
        query,
        variables,
      }),
    });

    if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);

    const json = await response.json();
    if (json.errors) throw new Error(json.errors[0].message);

    return json.data;
  } catch (error) {
    console.error("Error fetching AniList data:", error);
    throw error;
  }
}
