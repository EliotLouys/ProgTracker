import axios from "axios";

export const getDetailedActivity = async (
  activityId: number,
  accessToken: string,
) => {
  const resp = await axios.get(
    `https://www.strava.com/api/v3/activities/${activityId}`,
    {
      headers: { Authorization: `Bearer ${accessToken}` },
    },
  );
  return resp.data;
};
