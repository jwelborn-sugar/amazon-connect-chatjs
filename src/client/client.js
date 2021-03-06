import { UnImplementedMethodException } from "../core/exceptions";
import { GlobalConfig } from "../globalConfig";
import {
  REGION_CONFIG,
  REGIONS
} from "../constants";
import { LogManager } from "../log";
import { ConnectParticipant } from "./aws-sdk-connectparticipant.js";

class ChatClientFactoryImpl {
  constructor() {
    this.clientCache = {};
  }

  getCachedClient(optionsInput) {
    var options = Object.assign({}, optionsInput);
    var region = optionsInput.region || GlobalConfig.getRegion() || REGIONS.pdx;
    options.region = region;
    if (this.clientCache[region]) {
      return this.clientCache[region];
    }
    var client = this._createAwsClient(options);
    this.clientCache[region] = client;
    return client;
  }

  _createAwsClient(options) {
    var region = options.region;
    var endpointOverride = GlobalConfig.getEndpointOverride();
    var stageConfig = REGION_CONFIG[region];
    if (endpointOverride) {
      stageConfig.invokeUrl = endpointOverride;
    }
    return new AWSChatClient({
      endpoint: stageConfig.invokeUrl,
      region: region
    });
  }
}

/*eslint-disable*/
class ChatClient {
  sendMessage(participantToken, message, type) {
    throw new UnImplementedMethodException("sendTextMessage in ChatClient");
  }

  disconnectParticipant(participantToken) {
    throw new UnImplementedMethodException("disconnectParticipant in ChatClient");
  }

  sendEvent(connectionToken, contentType, content) {
    throw new UnImplementedMethodException("sendEvent in ChatClient");
  }

  createParticipantConnection(participantToken, type) {
    throw new UnImplementedMethodException("createParticipantConnection in ChatClient");
  }
}
/*eslint-enable*/

class AWSChatClient extends ChatClient {
  constructor(args) {
    super();
    var creds = new AWS.Credentials('','');
    var config = new AWS.Config({
      region: args.region,
      endpoint: args.endpoint,
      credentials: creds
    });
    this.chatClient = new AWS.ConnectParticipant(config);
    this.invokeUrl = args.endpoint;
    this.logger = LogManager.getLogger({ prefix: "ChatClient" });
  }

  createParticipantConnection(participantToken, type) {
    let self = this;
      var params = {
        Type: type,
        ParticipantToken: participantToken
      };
      var createParticipantConnectionRequest = self.chatClient.createParticipantConnection(
        params
      );
      return self._sendRequest(createParticipantConnectionRequest).then((res) => {
        self.logger.info("successfully create connection request");
        return res;
      }).catch((err) => {
        self.logger.error("error when creating connection request");
        return Promise.reject(err);
      });
  }

  disconnectParticipant(connectionToken) {
    let self = this;
      var params = {
        ConnectionToken: connectionToken
      };

      var disconnectParticipantRequest = self.chatClient.disconnectParticipant(
        params
      );
      return self._sendRequest(disconnectParticipantRequest).then((res) => {
        self.logger.info("successfully disconnect participant");
        return res;
      }).catch((err) => {
        self.logger.error("error when disconnecting participant");
        return Promise.reject(err);
      });
  }

  getTranscript(connectionToken, args) {
    let self = this;
    var params = {
    MaxResults: args.maxResults,
    NextToken: args.nextToken,
    ScanDirection: args.scanDirection,
    SortOrder: args.sortOrder,
    StartPosition: {
      Id: args.startPosition.id,
      AbsoluteTime: args.startPosition.absoluteTime,
      MostRecent: args.startPosition.mostRecent
    },
    ConnectionToken: connectionToken
    };
    if (args.contactId) {
      params.ContactId = args.contactId;
    }
    var getTranscriptRequest = self.chatClient.getTranscript(params);
    return self._sendRequest(getTranscriptRequest).then((res) => {
      self.logger.info("successfully get transcript");
      return res;
    }).catch((err) => {
      self.logger.error("error when getting transcript");
      return Promise.reject(err);
    });
  }

  sendMessage(connectionToken, content, contentType) {
    let self = this;
      var params = {
        Content: content,
        ContentType: contentType,
        ConnectionToken: connectionToken
      };
      var sendMessageRequest = self.chatClient.sendMessage(params);
      return self._sendRequest(sendMessageRequest).then((res) => {
        self.logger.info("successfully send message");
        return res;
      }).catch((err) => {
        self.logger.error("error when sending message");
        return Promise.reject(err);
      });
  }

  sendEvent(connectionToken, contentType, content) {
    let self = this;
      var params = {
        ConnectionToken: connectionToken,
        ContentType: contentType,
        Content: content
      };
      var sendEventRequest = self.chatClient.sendEvent(params);
      return self._sendRequest(sendEventRequest).then((res) => {
        self.logger.info("successfully send event");
        return res;
      }).catch((err) => {
        self.logger.error("error when sending event");
        return Promise.reject(err);
      });
  }

  _sendRequest(request) {
    return new Promise((resolve, reject) => {
      request
        .on("success", function(res) {
          resolve(res);
        })
        .on("error", function(err) {
          const errObj = {
            type: err.code,
            message: err.message,
            stack: err.stack ? err.stack.split('\n') : [],
          }
          reject(errObj);
        })
        .send();
    });
  }
}

var ChatClientFactory = new ChatClientFactoryImpl();
export { ChatClientFactory };
