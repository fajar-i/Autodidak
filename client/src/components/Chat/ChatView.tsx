import { memo, useCallback, useState } from 'react';
import { useRecoilValue } from 'recoil';
import { useForm } from 'react-hook-form';
import { Spinner } from '@librechat/client';
import { useParams } from 'react-router-dom';
import { Constants, buildTree } from 'librechat-data-provider';
import type { TMessage } from 'librechat-data-provider';
import type { ChatFormValues } from '~/common';
import { ChatContext, AddedChatContext, useFileMapContext, ChatFormProvider } from '~/Providers';
import {
  useResumableStreamToggle,
  useAddedResponse,
  useResumeOnLoad,
  useAdaptiveSSE,
  useChatHelpers,
} from '~/hooks';
import ConversationStarters from './Input/ConversationStarters';
import { useGetMessagesByConvoId } from '~/data-provider';
import MessagesView from './Messages/MessagesView';
import Presentation from './Presentation';
import ChatForm from './Input/ChatForm';
import Landing from './Landing';
import Header from './Header';
import Footer from './Footer';
import { cn } from '~/utils';
import store from '~/store';

import SkillTree from '../SkillTree/SkillTree'; // Sesuaikan path folder Anda

function LoadingSpinner() {
  return (
    <div className="relative flex-1 overflow-hidden overflow-y-auto">
      <div className="relative flex h-full items-center justify-center">
        <Spinner className="text-text-primary" />
      </div>
    </div>
  );
}

function ChatView({ index = 0 }: { index?: number }) {
  const { conversationId } = useParams();
  const rootSubmission = useRecoilValue(store.submissionByIndex(index));
  const centerFormOnLanding = useRecoilValue(store.centerFormOnLanding);

  const fileMap = useFileMapContext();
  const [showMap, setShowMap] = useState(true);
  const { data: messagesTree = null, isLoading } = useGetMessagesByConvoId(conversationId ?? '', {
    select: useCallback(
      (data: TMessage[]) => {
        const dataTree = buildTree({ messages: data, fileMap });
        return dataTree?.length === 0 ? null : (dataTree ?? null);
      },
      [fileMap],
    ),
    enabled: !!fileMap,
  });

  const chatHelpers = useChatHelpers(index, conversationId);
  const addedChatHelpers = useAddedResponse();

  useResumableStreamToggle(
    chatHelpers.conversation?.endpoint,
    chatHelpers.conversation?.endpointType,
  );

  useAdaptiveSSE(rootSubmission, chatHelpers, false, index);

  // Auto-resume if navigating back to conversation with active job
  // Wait for messages to load before resuming to avoid race condition
  useResumeOnLoad(conversationId, chatHelpers.getMessages, index, !isLoading);

  const methods = useForm<ChatFormValues>({
    defaultValues: { text: '' },
  });

  let content: JSX.Element | null | undefined;
  const isLandingPage =
    (!messagesTree || messagesTree.length === 0) &&
    (conversationId === Constants.NEW_CONVO || !conversationId);
  const isNavigating = (!messagesTree || messagesTree.length === 0) && conversationId != null;

  if (isLoading && conversationId !== Constants.NEW_CONVO) {
    content = <LoadingSpinner />;
  } else if ((isLoading || isNavigating) && !isLandingPage) {
    content = <LoadingSpinner />;
  } else if (!isLandingPage) {
    content = <MessagesView messagesTree={messagesTree} />;
  } else {
    content = <Landing centerFormOnLanding={centerFormOnLanding} />;
  }

  return (
    <ChatFormProvider {...methods}>
      <ChatContext.Provider value={chatHelpers}>
        <AddedChatContext.Provider value={addedChatHelpers}>
          <Presentation>
            <div className="flex h-full w-full flex-col overflow-hidden">
              {!isLoading && <Header />}

              {/* WRAPPER UTAMA UNTUK SPLIT SCREEN */}
              <div className="flex h-full w-full overflow-hidden flex-row">

                {/* AREA CHAT (Kiri) */}
                <div className={cn(
                  "flex h-full flex-col transition-all duration-500 relative",
                  showMap ? "w-1/2 border-r-4 border-black" : "w-full"
                )}>

                  {/* TOMBOL TOGGLE FLOATING (Neobrutalism Style) */}
                  <button
                    onClick={() => { setShowMap(!showMap); console.log("showmap : " + showMap) }}
                    className="absolute top-4 right-4 z-[60] p-2 bg-yellow-400 border-2 border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] hover:shadow-none active:translate-x-0.5 active:translate-y-0.5 transition-all font-bold text-xs"
                  >
                    {showMap ? 'HIDE MAP' : 'SHOW MAP'}
                  </button>

                  <div className={cn(
                    'flex flex-col flex-1',
                    isLandingPage ? 'items-center justify-end sm:justify-center' : 'overflow-y-auto'
                  )}>
                    {content}
                    <div className={cn(
                      'w-full',
                      isLandingPage && 'max-w-3xl transition-all duration-200 xl:max-w-4xl',
                    )}>
                      <ChatForm index={index} />
                      {isLandingPage ? <ConversationStarters /> : <Footer />}
                    </div>
                  </div>
                  {isLandingPage && <Footer />}
                </div>

                {/* AREA SKILL TREE / CANVAS (Kanan) */}
                {showMap && (
                  <div className="w-1/2 h-full bg-white relative overflow-hidden animate-in slide-in-from-right duration-500">
                    <SkillTree conversationId={conversationId} />
                  </div>
                )}

              </div>
            </div>
          </Presentation>
        </AddedChatContext.Provider>
      </ChatContext.Provider>
    </ChatFormProvider>
  );
}

export default memo(ChatView);
