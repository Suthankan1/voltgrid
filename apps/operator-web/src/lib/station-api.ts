export type StationStatus = "ONLINE" | "OFFLINE";

export type Station = {
  id: string;
  name: string;
  status: StationStatus;
};

type StationsQueryResponse = {
  data?: {
    stations: Station[];
  };
  errors?: Array<{
    message: string;
  }>;
};

export type StationSnapshot =
  | {
      state: "live";
      stations: Station[];
    }
  | {
      state: "unavailable";
      stations: [];
      message: string;
    };

const STATIONS_QUERY = `
  query OperatorStations {
    stations {
      id
      name
      status
    }
  }
`;

export async function getStationSnapshot(): Promise<StationSnapshot> {
  const endpoint = process.env.STATION_GRAPHQL_URL;

  if (!endpoint) {
    return {
      state: "unavailable",
      stations: [],
      message: "Station API is not configured.",
    };
  }

  try {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        query: STATIONS_QUERY,
      }),
      cache: "no-store",
    });

    if (!response.ok) {
      return {
        state: "unavailable",
        stations: [],
        message: `Station API returned HTTP ${response.status}.`,
      };
    }

    const payload = (await response.json()) as StationsQueryResponse;

    if (payload.errors?.length) {
      return {
        state: "unavailable",
        stations: [],
        message: payload.errors[0].message,
      };
    }

    return {
      state: "live",
      stations: payload.data?.stations ?? [],
    };
  } catch {
    return {
      state: "unavailable",
      stations: [],
      message: "Station API could not be reached.",
    };
  }
}

export type ConnectorStatus =
  | "AVAILABLE"
  | "OCCUPIED"
  | "RESERVED"
  | "UNAVAILABLE"
  | "FAULTED";

export type StationConnector = {
  evseId: number;
  connectorId: number;
  status: ConnectorStatus;
  statusUpdatedAt: string;
};

export type TransactionStatus = "ACTIVE" | "ENDED";

export type ChargingTransaction = {
  stationId: string;
  transactionId: string;
  evseId: number;
  connectorId: number;
  status: TransactionStatus;
  startedAt: string;
  endedAt: string | null;
  lastSequenceNumber: number;
};

type StationDetailQueryResponse = {
  data?: {
    station: Station | null;
    stationConnectors: StationConnector[];
    stationTransactions: ChargingTransaction[];
  };
  errors?: Array<{
    message: string;
  }>;
};

export type StationDetailSnapshot =
  | {
      state: "live";
      station: Station | null;
      connectors: StationConnector[];
      transactions: ChargingTransaction[];
    }
  | {
      state: "unavailable";
      station: null;
      connectors: [];
      transactions: [];
      message: string;
    };

const STATION_DETAIL_QUERY = `
  query OperatorStation($id: ID!) {
    station(id: $id) {
      id
      name
      status
    }

    stationConnectors(stationId: $id) {
      evseId
      connectorId
      status
      statusUpdatedAt
    }

    stationTransactions(stationId: $id) {
      stationId
      transactionId
      evseId
      connectorId
      status
      startedAt
      endedAt
      lastSequenceNumber
    }
  }
`;

export async function getStationDetail(
  stationId: string,
): Promise<StationDetailSnapshot> {
  const endpoint = process.env.STATION_GRAPHQL_URL;

  if (!endpoint) {
    return {
      state: "unavailable",
      station: null,
      connectors: [],
      transactions: [],
      message: "Station API is not configured.",
    };
  }

  try {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        query: STATION_DETAIL_QUERY,
        variables: {
          id: stationId,
        },
      }),
      cache: "no-store",
    });

    if (!response.ok) {
      return {
        state: "unavailable",
        station: null,
        connectors: [],
        transactions: [],
        message: `Station API returned HTTP ${response.status}.`,
      };
    }

    const payload =
      (await response.json()) as StationDetailQueryResponse;

    if (payload.errors?.length) {
      return {
        state: "unavailable",
        station: null,
        connectors: [],
        transactions: [],
        message: payload.errors[0].message,
      };
    }

    return {
      state: "live",
      station: payload.data?.station ?? null,
      connectors: payload.data?.stationConnectors ?? [],
      transactions: payload.data?.stationTransactions ?? [],
    };
  } catch {
    return {
      state: "unavailable",
      station: null,
      connectors: [],
      transactions: [],
      message: "Station API could not be reached.",
    };
  }
}