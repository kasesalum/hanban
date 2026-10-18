"use client";

import { LabelChip } from "@/components/boards/boardCard";
import Loading from "@/components/loading";
import { PostponeChip } from "@/components/boards/postponeChip";
import { isDeadlineOverdue } from "@/components/boards/deadlinePicker";
import type { UserTicket } from "@/lib/helper";

function TicketColumn({
  heading,
  tickets,
  loading,
  empty,
  onOpen,
}: {
  heading: string;
  tickets: UserTicket[];
  loading: boolean;
  empty: string;
  onOpen: (ticket: UserTicket) => void;
}) {
  return (
    <div className="min-w-0">
      <h2 className="text-xl font-semibold mb-3">
        {heading}
        {!loading && (
          <span className="ml-2 text-base font-normal text-gray-400">
            {tickets.length}
          </span>
        )}
      </h2>
      {loading ? (
        <Loading size="sm" label="Loading tickets" />
      ) : tickets.length === 0 ? (
        <p className="text-sm text-gray-400">{empty}</p>
      ) : (
        <ul className="space-y-2">
          {tickets.map((ticket) => {
            const overdue = isDeadlineOverdue(ticket.deadline, ticket.listId);
            return (
              <li key={`${ticket.boardId}-${ticket.id}`}>
                <button
                  type="button"
                  onClick={() => onOpen(ticket)}
                  className="w-full text-left rounded-xl bg-background-alt hover:bg-border-hover transition px-3 py-2 space-y-1"
                >
                  <p className="font-semibold text-white truncate">
                    {ticket.title || "Untitled"}
                  </p>
                  <p className="text-xs text-gray-400 truncate">
                    {ticket.boardName || "Untitled Board"}
                  </p>
                  {(ticket.labels.length > 0 ||
                    ticket.deadline ||
                    ticket.postponedDays > 0) && (
                    <div className="flex flex-wrap gap-1 pt-0.5">
                      {ticket.labels.map((id) => (
                        <LabelChip
                          key={id}
                          labelId={id}
                          labels={ticket.boardLabels}
                        />
                      ))}
                      {ticket.deadline && (
                        <span
                          className={`text-xs font-semibold px-2 py-1 rounded border ${
                            overdue
                              ? "border-red-500 text-red-300 bg-red-500/25"
                              : "border-amber-400/60 text-amber-200 bg-amber-500/20"
                          }`}
                        >
                          {overdue
                            ? `Overdue ${ticket.deadline}`
                            : ticket.deadline}
                        </span>
                      )}
                      <PostponeChip
                        days={ticket.postponedDays}
                        className="text-xs font-semibold px-2 py-1"
                      />
                    </div>
                  )}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

export default function AssignedTickets({
  todo,
  inProgress,
  loading,
  onOpen,
}: {
  todo: UserTicket[];
  inProgress: UserTicket[];
  loading: boolean;
  onOpen: (ticket: UserTicket) => void;
}) {
  return (
    <section>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <TicketColumn
          heading="To Do"
          tickets={todo}
          loading={loading}
          empty="No to do tickets."
          onOpen={onOpen}
        />
        <TicketColumn
          heading="In Progress"
          tickets={inProgress}
          loading={loading}
          empty="No tickets in progress."
          onOpen={onOpen}
        />
      </div>
    </section>
  );
}
