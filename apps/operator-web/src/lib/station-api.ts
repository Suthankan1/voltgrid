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

    const payload =
      (await response.json()) as StationsQueryResponse;

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

type NetworkTransactionsResponse = {
  data?: {
    transactions: ChargingTransaction[];
  };
  errors?: Array<{
    message: string;
  }>;
};

export type NetworkTransactionSnapshot =
  | {
      state: "live";
      transactions: ChargingTransaction[];
    }
  | {
      state: "unavailable";
      transactions: [];
      message: string;
    };

const NETWORK_TRANSACTIONS_QUERY = `
  query OperatorNetworkTransactions {
    transactions {
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

export async function getNetworkTransactions(): Promise<NetworkTransactionSnapshot> {
  const endpoint = process.env.STATION_GRAPHQL_URL;

  if (!endpoint) {
    return {
      state: "unavailable",
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
        query: NETWORK_TRANSACTIONS_QUERY,
      }),
      cache: "no-store",
    });

    if (!response.ok) {
      return {
        state: "unavailable",
        transactions: [],
        message: `Station API returned HTTP ${response.status}.`,
      };
    }

    const payload =
      (await response.json()) as NetworkTransactionsResponse;

    if (payload.errors?.length) {
      return {
        state: "unavailable",
        transactions: [],
        message: payload.errors[0].message,
      };
    }

    return {
      state: "live",
      transactions: payload.data?.transactions ?? [],
    };
  } catch {
    return {
      state: "unavailable",
      transactions: [],
      message: "Station API could not be reached.",
    };
  }
}

export type TransactionDataStatus =
  | "IN_PROGRESS"
  | "COMPLETE"
  | "INCOMPLETE"
  | "UNKNOWN";

export type TransactionCompleteness = {
  status: TransactionDataStatus;
  firstSequenceNumber: number | null;
  lastSequenceNumber: number;
  missingSequenceNumbers: number[];
};

export type TransactionMeterSample = {
  sequenceNumber: number;
  sampledAt: string;
  value: string;
  measurand: string | null;
  context: string | null;
  phase: string | null;
  location: string | null;
  unit: string | null;
  unitMultiplier: number;
};

type TransactionLookupResponse = {
  data?: {
    transaction: ChargingTransaction | null;
  };
  errors?: Array<{
    message: string;
  }>;
};

type TransactionDataResponse = {
  data?: {
    transactionCompleteness: TransactionCompleteness;
    transactionMeterSamples: TransactionMeterSample[];
  };
  errors?: Array<{
    message: string;
  }>;
};

export type TransactionInspectorSnapshot =
  | {
      state: "live";
      transaction: ChargingTransaction;
      completeness: TransactionCompleteness;
      meterSamples: TransactionMeterSample[];
    }
  | {
      state: "not-found";
    }
  | {
      state: "unavailable";
      message: string;
    };

const TRANSACTION_LOOKUP_QUERY = `
  query OperatorTransaction(
    $stationId: ID!
    $transactionId: ID!
  ) {
    transaction(
      stationId: $stationId
      transactionId: $transactionId
    ) {
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

const TRANSACTION_DATA_QUERY = `
  query OperatorTransactionData(
    $stationId: ID!
    $transactionId: ID!
  ) {
    transactionCompleteness(
      stationId: $stationId
      transactionId: $transactionId
    ) {
      status
      firstSequenceNumber
      lastSequenceNumber
      missingSequenceNumbers
    }

    transactionMeterSamples(
      stationId: $stationId
      transactionId: $transactionId
    ) {
      sequenceNumber
      sampledAt
      value
      measurand
      context
      phase
      location
      unit
      unitMultiplier
    }
  }
`;

export async function getTransactionInspector(
  stationId: string,
  transactionId: string,
): Promise<TransactionInspectorSnapshot> {
  const endpoint = process.env.STATION_GRAPHQL_URL;

  if (!endpoint) {
    return {
      state: "unavailable",
      message: "Station API is not configured.",
    };
  }

  const variables = {
    stationId,
    transactionId,
  };

  try {
    const lookupResponse = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        query: TRANSACTION_LOOKUP_QUERY,
        variables,
      }),
      cache: "no-store",
    });

    if (!lookupResponse.ok) {
      return {
        state: "unavailable",
        message: `Station API returned HTTP ${lookupResponse.status}.`,
      };
    }

    const lookupPayload =
      (await lookupResponse.json()) as TransactionLookupResponse;

    if (lookupPayload.errors?.length) {
      return {
        state: "unavailable",
        message: lookupPayload.errors[0].message,
      };
    }

    const transaction =
      lookupPayload.data?.transaction ?? null;

    if (!transaction) {
      return {
        state: "not-found",
      };
    }

    const dataResponse = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        query: TRANSACTION_DATA_QUERY,
        variables,
      }),
      cache: "no-store",
    });

    if (!dataResponse.ok) {
      return {
        state: "unavailable",
        message: `Station API returned HTTP ${dataResponse.status}.`,
      };
    }

    const dataPayload =
      (await dataResponse.json()) as TransactionDataResponse;

    if (dataPayload.errors?.length) {
      return {
        state: "unavailable",
        message: dataPayload.errors[0].message,
      };
    }

    if (!dataPayload.data) {
      return {
        state: "unavailable",
        message: "Transaction operational data was not returned.",
      };
    }

    return {
      state: "live",
      transaction,
      completeness: dataPayload.data.transactionCompleteness,
      meterSamples:
        dataPayload.data.transactionMeterSamples ?? [],
    };
  } catch {
    return {
      state: "unavailable",
      message: "Station API could not be reached.",
    };
  }
}